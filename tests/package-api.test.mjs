import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { build } from "tsdown";

const exec = promisify(execFile);
const project = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const tsc = require.resolve("typescript/bin/tsc");
const rootRuntime = [
  "Client",
  "JmapAbortError",
  "JmapClientError",
  "JmapConfigurationError",
  "JmapError",
  "JmapHttpError",
  "JmapMethodError",
  "JmapProtocolError",
  "JmapRequestLimitError",
  "JmapTransportError",
  "defineCapability",
  "ref",
].toSorted();
const capabilityRuntime = [
  "blob",
  "contacts",
  "core",
  "mail",
  "sieve",
  "submission",
  "vacationResponse",
].toSorted();
const unsupported = [
  "json-meta-client/internal",
  "json-meta-client/src/client.ts",
  "json-meta-client/dist/index.mjs",
  "json-meta-client/capabilities/core",
];
let consumer;

async function runNode(source) {
  const { stdout } = await exec(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: consumer,
    encoding: "utf8",
  });
  return stdout;
}

async function typecheck(module, moduleResolution, filename = "types.mts") {
  const { stdout } = await exec(
    process.execPath,
    [
      tsc,
      "--noEmit",
      "--strict",
      "--target",
      "esnext",
      "--module",
      module,
      "--moduleResolution",
      moduleResolution,
      filename,
    ],
    {
      cwd: consumer,
      encoding: "utf8",
    },
  );
  return stdout;
}

before(async () => {
  consumer = await mkdtemp(join(tmpdir(), "json-meta-client-package-"));
  const manifest = JSON.parse(await readFile(join(project, "package.json"), "utf8"));
  const { stdout } = await exec(
    "npm",
    [
      "pack",
      "--ignore-scripts",
      "--json",
      "--pack-destination",
      consumer,
      "--cache",
      join(consumer, "npm-cache"),
    ],
    {
      cwd: project,
      encoding: "utf8",
    },
  );
  const [packed] = JSON.parse(stdout);
  const installed = join(consumer, "node_modules", manifest.name);
  await mkdir(installed, { recursive: true });
  await exec("tar", [
    "-xzf",
    join(consumer, packed.filename),
    "--strip-components=1",
    "-C",
    installed,
  ]);
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({ type: "module", private: true }),
  );
  await cp(join(project, "tests", "fixtures", "package-api"), consumer, {
    recursive: true,
    filter: (source) => basename(source) !== "tsconfig.json",
  });
  await Promise.all(
    Object.keys(manifest.dependencies).map(async (dependency) => {
      const destination = join(consumer, "node_modules", dependency);
      await mkdir(dirname(destination), { recursive: true });
      await symlink(await realpath(join(project, "node_modules", dependency)), destination, "dir");
    }),
  );
});

after(async () => {
  if (consumer) await rm(consumer, { recursive: true, force: true });
});

void test("packed entry points expose exactly the supported runtime exports", async () => {
  const actual = JSON.parse(
    await runNode(
      "const fixture = await import('./runtime.mjs'); console.log(JSON.stringify(fixture));",
    ),
  );
  assert.deepEqual(actual.surfaces, {
    root: rootRuntime,
    capabilities: capabilityRuntime,
    community: ["maskedEmail"],
  });
  assert.equal(actual.coreUrn, "urn:ietf:params:jmap:core");
  assert.equal(actual.communityUrn, "https://www.fastmail.com/dev/maskedemail");
  assert.equal(actual.configurable.urn, "test:packed");
  for (const [name, constructorName] of Object.entries(actual.constructorNames))
    assert.equal(constructorName, name === "JmapMethodError" ? "JmapError" : name);
});

void test("Core.echo preserves supplied arguments with mail account defaults configured", async () => {
  assert.equal(await runNode("await (await import('./echo.mjs')).checkEcho();"), "");
});

void test("package metadata and encapsulation survive packing", async () => {
  const actual = JSON.parse(
    await runNode(
      "const { default: pkg } = await import('json-meta-client/package.json', { with: { type: 'json' } }); console.log(JSON.stringify(pkg));",
    ),
  );
  assert.deepEqual(Object.keys(actual.exports).toSorted(), [
    ".",
    "./capabilities",
    "./capabilities/community",
    "./package.json",
  ]);
  await Promise.all(
    unsupported.map(async (specifier) => {
      assert.equal(
        await runNode(
          `try { await import(${JSON.stringify(specifier)}); throw new Error('Unexpected import success'); } catch (error) { if (error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error; }`,
        ),
        "",
      );
    }),
  );
});

void test("packed declarations support Node and bundler consumer imports", async () => {
  assert.equal(await typecheck("nodenext", "nodenext"), "");
  assert.equal(await typecheck("esnext", "bundler"), "");
});

void test("declarations reject internal paths and incidental exports", async () => {
  const imports = unsupported.map(
    (specifier, index) => `import type * as Internal${index} from ${JSON.stringify(specifier)};`,
  );
  imports.push(
    "import { isRef, DEFAULT_CAPABILITIES, type Augment, type AugmentMethod, type Config } from 'json-meta-client';",
  );
  imports.push(
    "import { Client } from 'json-meta-client'; const client = new Client({ bearerToken: 'token', sessionUrl: 'https://example.test', capabilities: [] }); client.api.Core.get({});",
  );
  await writeFile(join(consumer, "unsupported.mts"), imports.join("\n"));
  await Promise.all(
    [
      ["nodenext", "nodenext"],
      ["esnext", "bundler"],
    ].map(async ([module, resolution]) => {
      await assert.rejects(
        () => typecheck(module, resolution, "unsupported.mts"),
        (error) => {
          assert.equal((error.stdout.match(/error TS2307:/g) ?? []).length, unsupported.length);
          assert.equal((error.stdout.match(/error TS(?:2305|2724|2459):/g) ?? []).length, 5);
          assert.equal((error.stdout.match(/error TS2339:/g) ?? []).length, 1);
          return true;
        },
      );
    }),
  );
});

void test("a browser bundle resolves packed entry points and retains public class names", async () => {
  const outDir = join(consumer, "browser");
  await build({
    config: false,
    cwd: consumer,
    entry: [join(consumer, "runtime.mjs")],
    outDir,
    platform: "browser",
    target: "esnext",
    deps: { alwaysBundle: ["json-meta-client", "eventsource-client"] },
    minify: true,
    dts: false,
    outputOptions: { keepNames: true },
    logLevel: "silent",
  });
  const bundled = await import(pathToFileURL(join(outDir, "runtime.js")).href);
  assert.deepEqual(bundled.surfaces, {
    root: rootRuntime,
    capabilities: capabilityRuntime,
    community: ["maskedEmail"],
  });
  for (const [name, constructorName] of Object.entries(bundled.constructorNames))
    assert.equal(constructorName, name === "JmapMethodError" ? "JmapError" : name);
  const code = await readFile(join(outDir, "runtime.js"), "utf8");
  assert.doesNotMatch(code, /(?:from\s*|import\s*\()["'](?:node:|json-meta-client)/);
});
