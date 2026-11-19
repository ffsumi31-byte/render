import { randomUUID } from "node:crypto";

export class QuotaError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
async function transaction(db, fn) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally { client.release(); }
}
export async function reserveTokens(db, hash, ceiling) {
  return transaction(db, async (c) => {
    // Same customer lock is used by grant/revoke admin mutations.
    const customer = (await c.query(
      "SELECT id,disabled FROM customers WHERE key_hash=$1 FOR UPDATE", [hash])).rows[0];
    if (!customer || customer.disabled) throw new QuotaError("Invalid or revoked customer key", 401);
    const pending = await c.query(
      "SELECT id FROM token_reservations WHERE customer_id=$1 AND status IN ('held','review')", [customer.id]);
    if (pending.rowCount) throw new QuotaError("Another request is running or awaiting reconciliation", 409);
    const row = (await c.query(
      "SELECT COALESCE(SUM(token_delta),0)::text AS balance FROM token_events WHERE customer_id=$1",
      [customer.id])).rows[0];
    const balance = BigInt(row.balance);
    if (balance < BigInt(ceiling)) {
      throw new QuotaError("Insufficient token allowance for the safety reservation. Add tokens or contact support.", 402);
    }
    const id = randomUUID();
    await c.query(
      "INSERT INTO token_reservations (id,customer_id,reserved_tokens,status) VALUES ($1,$2,$3,'held')",
      [id, customer.id, ceiling]);
    return { id, customerId: customer.id, remaining: (balance - BigInt(ceiling)).toString() };
  });
}
export async function settleTokens(db, reservation, actual) {
  if (!Number.isSafeInteger(actual) || actual < 0) throw new Error("Invalid settlement tokens");
  return transaction(db, async (c) => {
    await c.query("SELECT id FROM customers WHERE id=$1 FOR UPDATE", [reservation.customerId]);
    const held = (await c.query("SELECT status,reserved_tokens FROM token_reservations WHERE id=$1 FOR UPDATE",
      [reservation.id])).rows[0];
    if (!held || held.status !== "held") throw new QuotaError("Reservation cannot be settled twice", 409);
    await c.query(`INSERT INTO token_events (id,customer_id,kind,token_delta,request_id)
      VALUES ($1,$2,'usage',$3,$4)`, [randomUUID(), reservation.customerId, -actual, reservation.id]);
    const overrun = BigInt(actual) > BigInt(held.reserved_tokens);
    await c.query("UPDATE token_reservations SET status='settled',actual_tokens=$1,settled_at=NOW() WHERE id=$2",
      [actual, reservation.id]);
    if (overrun) await c.query("UPDATE customers SET disabled=TRUE WHERE id=$1", [reservation.customerId]);
    const row = (await c.query("SELECT COALESCE(SUM(token_delta),0)::text AS balance FROM token_events WHERE customer_id=$1",
      [reservation.customerId])).rows[0];
    return { remaining: row.balance, overrun };
  });
}

export function measuredUsage(usage) {
  // DeepSeek Anthropic input_tokens excludes cache hits. Never add start and
  // final usage together; this endpoint obtains one non-streaming final object.
  if (!usage || !Number.isSafeInteger(usage.input_tokens) || !Number.isSafeInteger(usage.output_tokens)) {
    throw new Error("Missing verified provider usage");
  }
  const fields = ["input_tokens","output_tokens","cache_read_input_tokens","cache_creation_input_tokens"];
  let total = 0;
  for (const field of fields) {
    const value = usage[field] ?? 0;
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid provider usage");
    total += value;
  }
  if (!Number.isSafeInteger(total)) throw new Error("Provider usage overflow");
  return total;
}
