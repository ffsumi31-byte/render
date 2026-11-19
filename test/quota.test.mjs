import assert from "node:assert/strict";
import { test } from "node:test";
import { measuredUsage, reserveTokens, settleTokens } from "../lib/quota.mjs";
import messages from "../api/messages.mjs";
test("Provider usage includes cache tokens exactly once", () => {
  assert.equal(measuredUsage({ input_tokens:10,output_tokens:5,cache_read_input_tokens:20,cache_creation_input_tokens:3 }),38);
  for (const usage of [null, {}, {input_tokens:-1,output_tokens:0}, {input_tokens:1,output_tokens:NaN}]) {
    assert.throws(() => measuredUsage(usage));
  }
});
function fakeDb(handler) {
  const queries = [];
  const client = { query: async (sql, args) => {
    queries.push(sql);
    return handler(sql, args) ?? { rows: [], rowCount: 0 };
  }, release() {} };
  return { db: { connect: async () => client }, queries };
}
test("Zero allowance rolls back without making a reservation", async () => {
  const {db,queries} = fakeDb((sql) => {
    if(sql.includes("key_hash")) return {rows:[{id:"user",disabled:false}]};
    if(sql.includes("AS balance")) return {rows:[{balance:"0"}]};
  });
  await assert.rejects(reserveTokens(db,"hash",100), /Insufficient/);
  assert.ok(queries.includes("ROLLBACK"));
  assert.ok(!queries.some((q)=>q.includes("INSERT")));
});
test("Concurrent/pending request is refused before any new reservation", async () => {
  const {db} = fakeDb((sql) => {
    if(sql.includes("key_hash")) return {rows:[{id:"user",disabled:false}]};
    if(sql.includes("SELECT id FROM token_reservations")) return {rowCount:1,rows:[{id:"pending"}]};
  });
  await assert.rejects(reserveTokens(db,"hash",100), /running/);
});
test("Settlement refuses duplicate debit", async () => {
  const {db,queries} = fakeDb((sql) => {
    if(sql.includes("SELECT status")) return {rows:[{status:"settled",reserved_tokens:"100"}]};
  });
  await assert.rejects(settleTokens(db,{id:"req",customerId:"user"},10), /twice/);
  assert.ok(!queries.some((q)=>q.includes("INSERT")));
});
test("Hosted endpoint refuses unauthenticated calls before touching provider/database", async () => {
  const response = await messages(new Request("https://example.test/v1/messages",{method:"POST"}));
  assert.equal(response.status,401);
});
