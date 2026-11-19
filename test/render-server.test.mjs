import { test } from "node:test";
import assert from "node:assert/strict";
import { createRenderServer } from "../render-server.mjs";

async function serve(t) {
  const server = createRenderServer("http://127.0.0.1");
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test("Render server serves only public files with CSP and hides source files", async (t) => {
  const base = await serve(t);
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-security-policy"), /script-src 'self'/);
  assert.match(await page.text(), /auth-screen/);
  const script = await fetch(`${base}/app.js`);
  assert.equal(script.status, 200);
  assert.match(script.headers.get("content-type"), /javascript/);
  for (const path of ["/workspace.js", "/preset-gears.js", "/console.css", "/mint-duck.svg",
    "/fonts/bricolage-grotesque.woff2", "/workspace.css", "/admin.css", "/admin.js", "/style.css"]) {
    const asset = await fetch(`${base}${path}`);
    assert.equal(asset.status, 200, path);
    assert.ok((await asset.text()).length > 0, path);
  }
  for (const path of ["/.env", "/schema.sql", "/api/admin.mjs", "/package.json"]) {
    assert.equal((await fetch(`${base}${path}`)).status, 404);
  }
});

test("Render local HTTP preview cannot authenticate or send provider requests", async (t) => {
  const base = await serve(t);
  assert.equal((await fetch(`${base}/api/account`)).status, 400);
  assert.equal((await fetch(`${base}/v1/messages`, { method: "POST" })).status, 400);
  assert.equal((await fetch(`${base}/api/admin`)).status, 503);
  assert.equal((await fetch(`${base}/admin`)).status, 200);
});

test("Render production origin must be HTTPS", () => {
  assert.throws(() => createRenderServer("http://public.example"));
  assert.throws(() => createRenderServer("https://public.example/path"));
  assert.doesNotThrow(() => createRenderServer("https://public.example"));
});
