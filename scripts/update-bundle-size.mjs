import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

import { build } from "rolldown";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const entry = packageJson.exports?.["."];

if (typeof entry !== "string" || !entry.startsWith("./")) {
  throw new Error('Expected package.json exports["."] to be a relative file path.');
}

// Each configuration is the code an app would write, bundled as its entry.
// Keep them in step with the README and docs examples they stand for.
const configurations = [
  {
    label: "Client with HTTP transport",
    code: `
      import { JsonMetaClient } from "json-meta-client";
      const client = new JsonMetaClient({
        sessionUrl: "https://jmap.example.com/.well-known/jmap",
        auth: "YOUR_ACCESS_TOKEN",
        capabilities: ["mail"],
      });
      const unread = client.api.Email.query({ filter: { notKeyword: "$seen" }, limit: 5 });
      console.log(await client.api.Email.get({ ids: unread.resultRef("/ids") }));
    `,
  },
  {
    label: "Client with WebSocket transport",
    code: `
      import { JsonMetaClient, webSocketTransport } from "json-meta-client";
      const client = new JsonMetaClient({
        sessionUrl: "https://jmap.example.com/.well-known/jmap",
        auth: "YOUR_ACCESS_TOKEN",
        capabilities: ["mail"],
        transport: webSocketTransport(),
      });
      const unread = client.api.Email.query({ filter: { notKeyword: "$seen" }, limit: 5 });
      console.log(await client.api.Email.get({ ids: unread.resultRef("/ids") }));
    `,
  },
  {
    label: "Everything (`export *`)",
    code: `export * from "json-meta-client";`,
  },
];

const entryPath = resolve(entry);

async function gzipSize(code) {
  const { output } = await build({
    input: "fixture",
    write: false,
    logLevel: "silent",
    output: { format: "esm", minify: true },
    plugins: [
      {
        name: "bundle-size-fixture",
        resolveId: (id) =>
          id === "fixture" ? id : id === "json-meta-client" ? entryPath : undefined,
        load: (id) => (id === "fixture" ? code : undefined),
      },
    ],
  });
  return gzipSync(output[0].code, { level: 9 }).byteLength;
}

const rows = await Promise.all(
  configurations.map(async ({ label, code }) => [
    label,
    `${((await gzipSize(code)) / 1000).toFixed(1)} kB`,
  ]),
);

// Lay the table out as the formatter would, so it leaves it unchanged
const header = ["Configuration", "Minified + gzip"];
const widths = header.map((title, column) =>
  Math.max(title.length, ...rows.map((row) => row[column].length)),
);
// Left-align the labels and right-align the sizes
const line = ([label, size]) => `| ${label.padEnd(widths[0])} | ${size.padStart(widths[1])} |`;
const table = [
  `| ${header[0].padEnd(widths[0])} | ${header[1]} |`,
  `| ${"-".repeat(widths[0])} | ${"-".repeat(widths[1] - 1)}: |`,
  ...rows.map(line),
].join("\n");

const start = "<!-- bundle-size:start -->";
const end = "<!-- bundle-size:end -->";
const block = [start, "", table, "", end].join("\n");

const readme = await readFile("README.md", "utf8");

if (!readme.includes(start) || !readme.includes(end)) {
  throw new Error("README.md is missing the bundle-size marker comments.");
}

const updated = readme.replace(new RegExp(`${start}[\\s\\S]*?${end}`), block);

if (updated !== readme) {
  await writeFile("README.md", updated);
}

console.log(table);
