import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";

const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
function page(response, protocol = "https:", hostname = "example.com") {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, {
      hidden: false, value: "", textContent: "", type: "password",
      setAttribute() {}, focus() {}, classList: { toggle() {} },
    });
    return elements.get(id);
  };
  const context = vm.createContext({
    document: { getElementById: element, querySelectorAll: () => [] },
    location: { protocol, hostname }, AbortSignal,
    fetch: async () => response,
  });
  vm.runInContext(source, context);
  element("key").value = `sk-gw-${"a".repeat(64)}`;
  return { element, submit: () => element("login").onsubmit({ preventDefault() {} }) };
}
test("Workspace is hidden until a valid account response, then logout locks it", async () => {
  const p = page(Response.json({
    customer: { id: "test-user", name: "CUBE" },
    tokens: { granted: "10000000", used: "10", remaining: "9999990" },
  }));
  assert.equal(p.element("workspace-screen").hidden, true);
  await p.submit();
  assert.equal(p.element("workspace-screen").hidden, false);
  assert.equal(p.element("auth-screen").hidden, true);
  assert.equal(p.element("name").textContent, "CUBE");
  assert.equal(p.element("overview-meter").value, 99);
  assert.equal(p.element("usage-percent").textContent, "0%");
  assert.equal(p.element("key").value, "");
  p.element("logout").onclick();
  assert.equal(p.element("workspace-screen").hidden, true);
  assert.equal(p.element("auth-screen").hidden, false);
  assert.equal(p.element("name").textContent, "");
});
test("Rejected keys and malformed success responses never unlock the workspace", async () => {
  for (const response of [
    Response.json({ error: "Invalid key" }, { status: 401 }),
    Response.json({ customer: { id: "x", name: "name" }, tokens: { granted: "not-numeric" } }),
  ]) {
    const p = page(response);
    await p.submit();
    assert.equal(p.element("workspace-screen").hidden, true);
    assert.equal(p.element("auth-screen").hidden, false);
  }
});
test("HTTP previews cannot authenticate", async () => {
  const p = page(null, "http:");
  await p.submit();
  assert.equal(p.element("workspace-screen").hidden, true);
  assert.match(p.element("status").textContent, /HTTPS/);
});
test("Local UI preview shows sample data without an account request and can be locked", () => {
  // The preview control is unhidden by app.js on local HTTP only.
  const local = page(null, "http:", "localhost");
  assert.equal(local.element("preview-workspace").hidden, false);
  local.element("preview-workspace").onclick();
  assert.equal(local.element("workspace-screen").hidden, false);
  assert.equal(local.element("preview-notice").hidden, false);
  assert.equal(local.element("refresh-usage").disabled, true);
  assert.match(local.element("name").textContent, /Sample customer/);
  assert.equal(local.element("usage-percent").textContent, "2.5%");
  local.element("logout").onclick();
  assert.equal(local.element("workspace-screen").hidden, true);
  assert.equal(local.element("preview-notice").hidden, true);
  assert.equal(local.element("refresh-usage").disabled, false);
  const hosted = page(null, "https:", "apiduck.onrender.com");
  assert.equal(hosted.element("preview-workspace").onclick, undefined);
});
