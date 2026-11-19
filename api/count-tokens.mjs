import { database } from "../lib/db.mjs";
import { keyHash } from "../lib/keys.mjs";
import { countMessageTokens } from "../lib/token-count.mjs";

const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});

export default async function countTokens(req) {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  if (new URL(req.url).protocol !== "https:") return json({ error: "HTTPS required" }, 400);

  let hash;
  try {
    const key = /^Bearer (sk-gw-[a-f0-9]{64})$/.exec(req.headers.get("authorization") ?? "")?.[1]
      ?? req.headers.get("x-api-key");
    hash = keyHash(key);
  } catch {
    return json({ error: "A valid customer API key is required" }, 401);
  }

  try {
    const customer = await database().query(
      "SELECT id FROM customers WHERE key_hash=$1 AND disabled=FALSE", [hash]);
    if (!customer.rowCount) return json({ error: "Invalid or revoked customer key" }, 401);

    const raw = await req.text();
    if (Buffer.byteLength(raw) > 512_000) return json({ error: "Request body too large" }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid request body" }, 400);

    return new Response(JSON.stringify({ input_tokens: countMessageTokens(body) }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Gateway-Tokenizer": "cl100k_base-estimate",
      },
    });
  } catch {
    return json({ error: "Token-count service unavailable. Check database configuration." }, 503);
  }
}

export const config = { path: "/v1/messages/count_tokens" };
