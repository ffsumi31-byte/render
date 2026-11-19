import assert from "node:assert/strict";
import { test } from "node:test";
import countTokens from "../api/count-tokens.mjs";
import { countMessageTokens } from "../lib/token-count.mjs";

test("count_tokens uses cl100k_base for known text and includes framing", () => {
  assert.equal(countMessageTokens({ messages: [{ role: "user", content: "hello world" }] }), 26);
  assert.ok(countMessageTokens({ messages: [{ role: "user", content: "Hello 世界 👋" }] }) > 0);
});

test("hosted count_tokens requires a valid customer key and HTTPS", async () => {
  const noKey = await countTokens(new Request("https://apiduh.netlify.app/v1/messages/count_tokens", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [] }),
  }));
  assert.equal(noKey.status, 401);

  const http = await countTokens(new Request("http://apiduh.netlify.app/v1/messages/count_tokens", {
    method: "POST", headers: { Authorization: `Bearer sk-gw-${"a".repeat(64)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [] }),
  }));
  assert.equal(http.status, 400);
});
