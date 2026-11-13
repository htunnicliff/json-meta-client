// Checks the package as consumers receive it: packs the built `dist`,
// installs the tarball into a throwaway project, type-checks that project
// against the published declarations with `skipLibCheck: false`, and runs a
// `Core/echo` call against a mocked server. Run `pnpm build` first.

import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd();
const fixture = path.join(root, "scripts", "package-fixture");
const project = await mkdtemp(path.join(tmpdir(), "json-meta-client-package-"));

const run = (command, args, cwd) =>
  execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

try {
  run("pnpm", ["pack", "--pack-destination", project], root);
  const tarball = (await readdir(project)).find((name) => name.endsWith(".tgz"));
  if (!tarball) throw new Error("`pnpm pack` produced no tarball");

  await cp(fixture, project, { recursive: true });

  run("pnpm", ["add", `./${tarball}`], project);
  run(path.join(root, "node_modules", ".bin", "tsc"), ["-p", project], project);

  const output = run(process.execPath, ["index.ts"], project).trim();
  if (output !== JSON.stringify({ hello: "world" })) {
    throw new Error(`Unexpected Core/echo output from the packed package: ${output}`);
  }
  console.log("The packed package installs, type-checks and runs Core/echo.");
} finally {
  await rm(project, { recursive: true, force: true });
}
