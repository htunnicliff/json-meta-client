import { readFile, writeFile } from "node:fs/promises";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const entry = packageJson.exports?.["."];

if (typeof entry !== "string" || !entry.startsWith("./")) {
  throw new Error('Expected package.json exports["."] to be a relative file path.');
}

const bundle = await readFile(entry);
const gzipSize = gzipSync(bundle, { level: 9 }).byteLength;
const brotliSize = brotliCompressSync(bundle, {
  params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
}).byteLength;

const formatSize = (bytes) =>
  bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(2)} MB`
    : `${(bytes / 1_000).toFixed(2)} kB`;

const badge = (label, bytes) => {
  const message = encodeURIComponent(formatSize(bytes));
  return `<img src="https://img.shields.io/badge/${label}-${message}-blue" alt="${label} bundle size">`;
};

const start = "<!-- bundle-size:start -->";
const end = "<!-- bundle-size:end -->";
const readme = await readFile("README.md", "utf8");
const block = [
  start,
  `  ${badge("gzip", gzipSize)}`,
  `  ${badge("brotli", brotliSize)}`,
  end,
].join("\n");

if (!readme.includes(start) || !readme.includes(end)) {
  throw new Error("README.md is missing the bundle-size marker comments.");
}

const updated = readme.replace(
  new RegExp(`${start}[\\s\\S]*?${end}`),
  block,
);

if (updated !== readme) {
  await writeFile("README.md", updated);
}

console.log(`Bundle size: gzip ${formatSize(gzipSize)}, brotli ${formatSize(brotliSize)} (${entry})`);
