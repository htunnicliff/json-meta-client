import { readFile } from "node:fs/promises";
// PROTOTYPE (#201): runs every case in a module Web Worker in each browser.
// Usage: node run.mjs <path-to-playwright-module> [chromium|firefox|webkit ...]
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { cases } from "./cases.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const pw = createRequire(import.meta.url)(process.argv[2]);
const browsers = process.argv.slice(3).length
  ? process.argv.slice(3)
  : ["chromium", "firefox", "webkit"];

const server = createServer(async (req, res) => {
  const url = req.url === "/" ? "/index.html" : req.url;
  try {
    const body = await readFile(join(here, url === "/index.html" ? "index.html" : url));
    res.setHeader("content-type", url.endsWith(".js") ? "text/javascript" : "text/html");
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end();
  }
}).listen(0);
const port = server.address().port;

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function summarize(r) {
  const line = (loc) => r.report.ranges[loc].start.line;
  const calls = {};
  for (const [id, loc] of Object.entries(r.report.calls))
    (calls[id.split("::")[0]] ??= []).push(line(loc));
  for (const k in calls) calls[k].sort((a, b) => a - b);
  const pending = {};
  for (const [loc, n] of Object.entries(r.report.pending))
    pending[line(loc)] = (pending[line(loc)] ?? 0) + n;
  const notReached = [...new Set(r.report.notReached.map(line))].sort((a, b) => a - b);
  return {
    calls,
    pending,
    notReached,
    ids: r.requestIds.length,
    mapped: Object.keys(r.report.calls).length,
  };
}

let failed = 0;
for (const name of browsers) {
  const browser = await pw[name].launch();
  const page = await browser.newPage();
  await page.goto(`http://localhost:${port}/`);
  console.log(`\n== ${name} ${browser.version()}`);
  for (const c of cases) {
    const out = await page.evaluate((source) => window.runCase(source), c.source.join("\n"));
    if (!out.ok) {
      failed++;
      console.log(`  FAIL ${c.name}: ${out.error}`);
      continue;
    }
    const s = summarize(out.result);
    const ok =
      same(s.calls, c.expect.calls) &&
      same(s.pending, c.expect.pending) &&
      same(s.notReached, c.expect.notReached) &&
      s.ids === s.mapped;
    if (!ok) failed++;
    const t = out.result.timing;
    console.log(
      `  ${ok ? "ok  " : "FAIL"} ${c.name}  [plain ${t.plainMs.toFixed(1)}ms, instrumented ${t.instrumentedMs.toFixed(1)}ms]`,
    );
    if (!ok)
      console.log(
        "       got",
        JSON.stringify(s),
        "\n       want",
        JSON.stringify(c.expect),
        out.result.error ?? "",
      );
  }
  await browser.close();
}
server.close();
process.exit(failed ? 1 : 0);
