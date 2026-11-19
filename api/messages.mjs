import { database } from "../lib/db.mjs";
import { keyHash } from "../lib/keys.mjs";
import { reserveTokens, settleTokens, measuredUsage } from "../lib/quota.mjs";

function failure(message, status) {
  return Response.json({ type:"error", error: { type: "api_error", message } }, {
    status, headers: { "Cache-Control": "no-store" },
  });
}
// Buffer upstream completion so verified usage is committed before returning an
// answer. Native incremental streaming and provider-error reconciliation are later work.
function asSse(message) {
  const events = [];
  const emit = (type, data) => events.push(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  emit("message_start", { message: { ...message, content: [], stop_reason: null,
    usage: { ...message.usage, output_tokens: 0 } } });
  for (const [index, block] of message.content.entries()) {
    emit("content_block_start", { index, content_block: block });
    emit("content_block_stop", { index });
  }
  emit("message_delta", { delta: { stop_reason: message.stop_reason, stop_sequence: message.stop_sequence ?? null },
    usage: message.usage });
  emit("message_stop", {});
  return events.join("");
}
export default async function messages(req) {
  if (req.method !== "POST") return failure("POST required", 405);
  if (new URL(req.url).protocol !== "https:") return failure("HTTPS required", 400);
  let hash;
  try {
    const key = /^Bearer (sk-gw-[a-f0-9]{64})$/.exec(req.headers.get("authorization") ?? "")?.[1]
      ?? req.headers.get("x-api-key");
    hash = keyHash(key);
  } catch { return failure("A valid customer API key is required", 401); }
  if (process.env.INFERENCE_ENABLED !== "true") return failure("Hosted inference has not been enabled by the administrator", 503);
  if (!process.env.DEEPSEEK_API_KEY) return failure("Provider is not configured", 503);
  const ceiling = Number(process.env.MAX_PROVIDER_REQUEST_TOKENS);
  if (!Number.isSafeInteger(ceiling) || ceiling < 1) return failure("Verified provider token ceiling is not configured", 503);
  let reservation;
  try {
    const raw = await req.text();
    if (Buffer.byteLength(raw) > 512000) return failure("Request body too large", 413);
    let body;
    try { body = JSON.parse(raw); } catch { return failure("Invalid JSON", 400); }
    if (!body || !Array.isArray(body.messages) || !body.messages.length) return failure("Messages required", 400);
    if (!Number.isInteger(body.max_tokens) || body.max_tokens < 1 || body.max_tokens > 4096) {
      return failure("max_tokens must be between 1 and 4096 for this hosted test", 400);
    }
    if (body.tools?.some((tool) => tool.type || !tool.input_schema)) {
      return failure("Only client-defined tools are supported; no paid server tools", 400);
    }
    const upstream = {
      // Explicit model avoids provider mapping of Opus aliases to a pricier model.
      model: "deepseek-flash", stream: false, thinking: { type: "disabled" },
      max_tokens: body.max_tokens, messages: body.messages,
      ...(body.system ? { system: body.system } : {}),
      ...(body.tools ? { tools: body.tools } : {}),
      ...(body.tool_choice ? { tool_choice: body.tool_choice } : {}),
    };
    reservation = await reserveTokens(database(), hash, ceiling);
    const result = await fetch("https://api.deepseek.com/anthropic/v1/messages", {
      method: "POST", headers: { "content-type": "application/json", "x-api-key": process.env.DEEPSEEK_API_KEY },
      body: JSON.stringify(upstream), signal: AbortSignal.timeout(45000),
    });
    if (!result.ok) throw new Error("Provider rejected request");
    const message = await result.json();
    if (message.type !== "message" || !Array.isArray(message.content)) throw new Error("Invalid provider response");
    const actual = measuredUsage(message.usage);
    const settlement = await settleTokens(database(), reservation, actual);
    if (settlement.overrun) return failure("Provider exceeded the verified ceiling. Account frozen for reconciliation.", 503);
    const headers = {
      "Cache-Control": "no-store", "X-Gateway-Tokens-Used": String(actual),
      "X-Gateway-Tokens-Remaining": settlement.remaining,
      "X-Gateway-Request-ID": reservation.id,
      "Content-Type": body.stream ? "text/event-stream; charset=utf-8" : "application/json",
    };
    return new Response(body.stream ? asSse(message) : JSON.stringify(message), { headers });
  } catch (error) {
    if (reservation) {
      // Unknown upstream billing outcome: never refund automatically. Durable
      // held reservation blocks further calls until an admin reconciles it.
      return failure(`Request could not be settled. Reservation ${reservation.id} held for support review.`, 503);
    }
    return failure(error.status ? error.message : "Account service unavailable", error.status ?? 503);
  }
}
export const config = { path: "/v1/messages" };
