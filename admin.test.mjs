import { test } from "node:test";
import assert from "node:assert/strict";
import { authorizeAdmin } from "../lib/admin-auth.mjs";
import admin from "../api/admin.mjs";
const key = `sk-admin-${"a".repeat(64)}`;
function request(method = "GET", headers = {}, url = "https://example.test/api/admin") {
  return new Request(url, { method, headers: { Authorization: `Bearer ${key}`, ...headers } });
}
test("Admin authorization fails closed when unconfigured and on customer keys", () => {
  assert.equal(authorizeAdmin(request(), ""), 503);
  assert.equal(authorizeAdmin(request("GET", { Authorization: `Bearer sk-gw-${"a".repeat(64)}` }), key), 401);
  assert.equal(authorizeAdmin(request("GET", { Authorization: `Bearer sk-admin-${"b".repeat(64)}` }), key), 401);
  assert.equal(authorizeAdmin(request(), key), 200);
  assert.equal(authorizeAdmin(request("GET", {}, "http://example.test/api/admin"), key), 400);
});
test("Admin mutations require same-origin JSON in addition to the key", () => {
  assert.equal(authorizeAdmin(request("POST"), key), 403);
  assert.equal(authorizeAdmin(request("POST", { Origin: "https://evil.test", "Content-Type": "application/json" }), key), 403);
  assert.equal(authorizeAdmin(request("POST", { Origin: "https://example.test" }), key), 415);
  assert.equal(authorizeAdmin(request("POST", { Origin: "https://example.test", "Content-Type": "application/json" }), key), 200);
});
test("Unconfigured admin endpoint never reaches the database or reveals a key", async () => {
  const previous = process.env.ADMIN_ACCESS_KEY;
  delete process.env.ADMIN_ACCESS_KEY;
  try {
    const result = await admin(request());
    assert.equal(result.status, 503);
    assert.equal(result.headers.get("cache-control"), "no-store");
    assert.ok(!(await result.text()).includes(key));
  } finally { if (previous !== undefined) process.env.ADMIN_ACCESS_KEY = previous; }
});
test("Admin endpoint distinguishes missing credentials from blocked writes without exposing secrets", async () => {
  const previous = process.env.ADMIN_ACCESS_KEY;
  process.env.ADMIN_ACCESS_KEY = key;
  try {
    const bad = await admin(request("GET", { Authorization: `Bearer sk-admin-${"b".repeat(64)}` }));
    assert.equal(bad.status, 401);
    assert.match((await bad.json()).error, /does not match/);
    const blocked = await admin(request("POST", { Origin: "https://other.example", "Content-Type": "application/json" }));
    assert.equal(blocked.status, 403);
    assert.match((await blocked.json()).error, /origin/);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_ACCESS_KEY;
    else process.env.ADMIN_ACCESS_KEY = previous;
  }
});
