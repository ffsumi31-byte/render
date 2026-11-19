import { randomUUID } from "node:crypto";
import { database } from "../lib/db.mjs";
import { mintKey, keyHash, positiveTokens } from "../lib/keys.mjs";

// Run ONLY on the administrator's computer with DATABASE_URL set.
// No public unauthenticated "create customer" endpoint exists.
const [action, ...args] = process.argv.slice(2);
let db;
try {
  if (!["issue", "revoke", "grant"].includes(action)) throw new Error("Choose issue, revoke, or grant");
  const amount = action === "revoke" ? null : positiveTokens(args[1] ?? (action === "issue" ? "10000000" : ""));
  if (!args[0]) throw new Error("Provide a customer name (issue) or UUID (revoke/grant)");
  db = database();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    if (action === "issue") {
      const id = randomUUID();
      const key = mintKey();
      await client.query("INSERT INTO customers (id,name,key_hash) VALUES ($1,$2,$3)", [id, args[0], keyHash(key)]);
      await client.query("INSERT INTO token_events (id,customer_id,kind,token_delta) VALUES ($1,$2,'grant',$3)",
        [randomUUID(), id, amount]);
      await client.query("COMMIT");
      console.log(`Customer ID: ${id}\nLifetime token allowance: ${amount}`);
      console.log(`Customer key (shown once; deliver privately): ${key}`);
    } else if (action === "revoke") {
      const result = await client.query("UPDATE customers SET disabled=TRUE WHERE id=$1 RETURNING id", [args[0]]);
      if (!result.rowCount) throw new Error("Customer not found");
      await client.query("COMMIT");
      console.log("Customer key revoked.");
    } else {
      const result = await client.query("SELECT id FROM customers WHERE id=$1 AND disabled=FALSE FOR UPDATE", [args[0]]);
      if (!result.rowCount) throw new Error("Customer not found or disabled");
      await client.query("INSERT INTO token_events (id,customer_id,kind,token_delta) VALUES ($1,$2,'grant',$3)",
        [randomUUID(), args[0], amount]);
      await client.query("COMMIT");
      console.log(`Granted ${amount} additional lifetime tokens.`);
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
} catch {
  console.error("Admin operation failed. Check arguments, DATABASE_URL, and database schema. No credentials printed.");
  process.exitCode = 1;
} finally {
  if (db) await db.end();
}
