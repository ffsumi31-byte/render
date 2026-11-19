import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "../public");
test("Both pages reference existing local scripts and styles", () => {
  for (const page of ["index.html", "admin.html"]) {
    const html = readFileSync(join(publicDir, page), "utf8");
    for (const [, asset] of html.matchAll(/(?:src|href)="\/([^"#?]+\.(?:css|js|svg))[^"]*"/g)) {
      assert.ok(existsSync(join(publicDir, asset)), `${page} references missing ${asset}`);
    }
  }
  const css = readFileSync(join(publicDir, "console.css"), "utf8");
  for (const [, asset] of css.matchAll(/url\(["']?\/([^)"']+)["']?\)/g)) {
    assert.ok(existsSync(join(publicDir, asset)), `console.css references missing ${asset}`);
  }
});
test("Customer and admin script hooks survive the HTML integration", () => {
  for (const [page, script] of [["index.html", "app.js"], ["admin.html", "admin.js"]]) {
    const html = readFileSync(join(publicDir, page), "utf8");
    const js = readFileSync(join(publicDir, script), "utf8");
    for (const [, id] of js.matchAll(/\$\("([^"]+)"\)/g)) {
      assert.match(html, new RegExp(`id="${id}"`), `${script} requires ${id}`);
    }
  }
});
test("Local preview notice spans the desktop workspace grid", () => {
  const css = readFileSync(join(publicDir, "console.css"), "utf8");
  assert.match(css, /#preview-notice\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/s);
});
test("Customer navigation stays focused and unreleased downloads are not advertised", () => {
  const html = readFileSync(join(publicDir, "index.html"), "utf8");
  const nav = html.match(/<nav aria-label="Workspace">([\s\S]*?)<\/nav>/)?.[1] ?? "";
  assert.deepEqual([...nav.matchAll(/<a\s+href="#([^"]+)"/g)].map((match) => match[1]),
    ["overview", "downloads", "models"]);
  assert.doesNotMatch(html, /id="toolkit"|releases\/download\//);
  assert.match(html, /id="models"/);
  assert.match(html, /href="#account" aria-label="View balance details"/);
  const home = html.match(/<section id="overview"[\s\S]*?<\/section>/)?.[0] ?? "";
  assert.match(home, /WINDOWS \/ POWERSHELL/);
  assert.match(home, /LINUX \/ TERMINAL/);
});
