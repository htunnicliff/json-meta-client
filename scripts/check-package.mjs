// Checks the package as consumers receive it: packs the built `dist`,
// installs the tarball into a throwaway project, type-checks that project
// against the published declarations with `skipLibCheck: false`, and runs a
// `Core/echo` call against a mocked server. Run `pnpm build` first.

import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd();
const project = await mkdtemp(path.join(tmpdir(), "json-meta-client-package-"));

const run = (command, args, cwd) =>
  execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

const consumer = `import { defineCapability, JsonMetaClient } from "json-meta-client";

const notes = defineCapability({ urn: "urn:example:notes", entities: ["Note"] }).withMethods<{
  Note: { get: { input: { ids: string[] }; output: { list: { id: string }[] } } };
}>();

const options = { auth: "token", sessionUrl: "https://jmap.test/session" } as const;

// Type-only checks: these functions are never called.
export function mailOnly(): unknown {
  const client = new JsonMetaClient({ ...options, capabilities: ["mail"] });
  // @ts-expect-error S/MIME properties need the smime capability.
  return client.api.Email.get({ properties: ["smimeStatus"] });
}
export function withSmime(): unknown {
  const client = new JsonMetaClient({ ...options, capabilities: ["mail", "smime"] });
  return client.api.Email.get({ properties: ["subject", "smimeStatus"] });
}
export function custom(): unknown {
  const client = new JsonMetaClient({ ...options, capabilities: [notes] });
  return client.api.Note.get({ ids: [] });
}

const session = {
  capabilities: {
    "urn:ietf:params:jmap:core": { maxCallsInRequest: 16, maxSizeRequest: 10_000_000 },
  },
  accounts: { a1: { name: "a", isPersonal: true, isReadOnly: false, accountCapabilities: {} } },
  primaryAccounts: { "urn:ietf:params:jmap:core": "a1" },
  username: "user",
  apiUrl: "https://jmap.test/api",
  downloadUrl: "https://jmap.test/download",
  uploadUrl: "https://jmap.test/upload",
  eventSourceUrl: "https://jmap.test/events",
  state: "state",
};

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = new Request(input, init);
  if (request.url === options.sessionUrl) return Response.json(session);
  const body = (await request.json()) as { methodCalls: [string, object, string][] };
  return Response.json({ sessionState: "state", methodResponses: body.methodCalls });
};

const client = new JsonMetaClient({ ...options, capabilities: [] });
console.log(JSON.stringify(await client.api.Core.echo({ hello: "world" })));
`;

try {
  run("pnpm", ["pack", "--pack-destination", project], root);
  const tarball = (await readdir(project)).find((name) => name.endsWith(".tgz"));
  if (!tarball) throw new Error("`pnpm pack` produced no tarball");

  await writeFile(
    path.join(project, "package.json"),
    JSON.stringify({ name: "package-check", private: true, type: "module" }),
  );
  await writeFile(
    path.join(project, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "nodenext",
        target: "esnext",
        lib: ["esnext", "dom"],
        types: [],
        strict: true,
        skipLibCheck: false,
        noEmit: true,
      },
      include: ["index.ts"],
    }),
  );
  await writeFile(path.join(project, "index.ts"), consumer);

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
