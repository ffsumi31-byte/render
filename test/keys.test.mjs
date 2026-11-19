import assert from "node:assert/strict";
import { test } from "node:test";
import { keyHash, mintKey, positiveTokens } from "../lib/keys.mjs";
test("Customer keys are distinct from provider keys and stored hashed", () => {
  const a = mintKey(), b = mintKey();
  assert.notEqual(a, b);
  assert.match(a, /^sk-gw-[a-f0-9]{64}$/);
  assert.match(keyHash(a), /^[a-f0-9]{64}$/);
  assert.equal(keyHash(a), keyHash(a));
  assert.notEqual(keyHash(a), a);
  assert.throws(() => keyHash("sk-or-v1-provider-secret"));
  assert.throws(() => keyHash(undefined));
});
test("Lifetime grants require bounded positive integers", () => {
  assert.equal(positiveTokens("10000000"), 10000000);
  for (const bad of ["-1", "0", "1.5", "NaN", "1e10", "9999999999999999999"]) {
    assert.throws(() => positiveTokens(bad));
  }
});
