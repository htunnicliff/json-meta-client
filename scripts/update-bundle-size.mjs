import { readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const entry = packageJson.exports?.["."];

if (typeof entry !== "string" || !entry.startsWith("./")) {
  throw new Error('Expected package.json exports["."] to be a relative file path.');
}

const bundle = await readFile(entry);
const gzipSize = gzipSync(bundle, { level: 9 }).byteLength;

const formatSize = (bytes) =>
  bytes >= 1_000_000 ? `${Math.round(bytes / 1_000_000)} MB` : `${Math.round(bytes / 1_000)} kB`;

const start = "<!-- bundle-size:start -->";
const end = "<!-- bundle-size:end -->";
const badge = `<img src="https://img.shields.io/badge/gzip-${encodeURIComponent(formatSize(gzipSize))}-blue" alt="gzip bundle size">`;
const block = [start, `  ${badge}`, `  ${end}`].join("\n");

const readme = await readFile("README.md", "utf8");

if (!readme.includes(start) || !readme.includes(end)) {
  throw new Error("README.md is missing the bundle-size marker comments.");
}

const updated = readme.replace(new RegExp(`${start}[\\s\\S]*?${end}`), block);

if (updated !== readme) {
  await writeFile("README.md", updated);
}

console.log(`Bundle size: gzip ${formatSize(gzipSize)} (${entry})`);
