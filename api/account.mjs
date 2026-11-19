import { database } from "../lib/db.mjs";
import { keyHash } from "../lib/keys.mjs";

function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
export default async function account(req) {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  if (new URL(req.url).protocol !== "https:") return json({ error: "HTTPS required" }, 400);
  let hash;
  try {
    const key = /^Bearer (sk-gw-[a-f0-9]{64})$/.exec(req.headers.get("authorization") ?? "")?.[1];
    hash = keyHash(key);
  } catch {
    return json({ error: "Use the customer key issued by this service, not a provider key." }, 401);
  }
  try {
    const result = await database().query(`
      SELECT c.id, c.name,
        COALESCE(SUM(CASE WHEN e.kind = 'grant' THEN e.token_delta ELSE 0 END), 0)::text AS granted,
        COALESCE(-SUM(CASE WHEN e.kind = 'usage' THEN e.token_delta ELSE 0 END), 0)::text AS used,
        (COALESCE(SUM(e.token_delta), 0) - COALESCE((SELECT SUM(r.reserved_tokens)
          FROM token_reservations r WHERE r.customer_id=c.id AND r.status IN ('held','review')),0))::text AS remaining,
        COALESCE((SELECT SUM(r.reserved_tokens) FROM token_reservations r
          WHERE r.customer_id=c.id AND r.status IN ('held','review')),0)::text AS reserved
      FROM customers c LEFT JOIN token_events e ON e.customer_id = c.id
      WHERE c.key_hash = $1 AND c.disabled = FALSE
      GROUP BY c.id, c.name`, [hash]);
    const row = result.rows[0];
    if (!row) return json({ error: "Invalid or revoked customer key" }, 401);
    return json({
      customer: { id: row.id, name: row.name },
      tokens: { granted: row.granted, used: row.used, remaining: row.remaining, reserved: row.reserved, expires: null },
      inferenceEnabled: process.env.INFERENCE_ENABLED === "true",
      note: "Balances exclude outstanding reservations. Hosted main-provider usage only; local calls and helpers are not metered here.",
    });
  } catch {
    // Never include SQL errors, connection strings, or authorization headers.
    return json({ error: "Account service unavailable. Check server database setup." }, 503);
  }
}
export const config = { path: "/api/account" };
