import assert from "node:assert/strict";
import { test } from "node:test";
import account from "../api/account.mjs";
import { mintKey } from "../lib/keys.mjs";

test("Account endpoint requires HTTPS and only accepts GET", async () => {
  assert.equal((await account(new Request("http://example.test/api/account"))).status, 400);
  assert.equal((await account(new Request("https://example.test/api/account", { method: "POST" }))).status, 405);
});
test("Provider keys are rejected without exposing credentials", async () => {
  const secret = "sk-or-v1-not-a-customer-key";
  const response = await account(new Request("https://example.test/api/account", {
    headers: { Authorization: `Bearer ${secret}` },
  }));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.ok(!(await response.text()).includes(secret));
});
test("Unconfigured database fails safely without granting a fake balance", async () => {
  const before = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const response = await account(new Request("https://example.test/api/account", {
      headers: { Authorization: `Bearer ${mintKey()}` },
    }));
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.tokens, undefined);
  } finally {
    if (before !== undefined) process.env.DATABASE_URL = before;
  }
});
