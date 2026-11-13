import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { declarationFiles, readDeclarations } from "./declarations.ts";

const roots: string[] = [];

async function fixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "playground-declarations-"));
  roots.push(root);
  await Promise.all(
    Object.entries(files).map(async ([name, contents]) => {
      const file = path.join(root, name);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, contents);
    }),
  );
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe(declarationFiles, () => {
  it("puts the library's declaration where the package name resolves", () => {
    expect(declarationFiles({ library: "export {};", typeFest: new Map() })).toEqual([
      { path: "/node_modules/json-meta-client/index.d.ts", content: "export {};" },
    ]);
  });

  it("keeps type-fest's file tree so its relative imports resolve", () => {
    const typeFest = new Map([
      ["index.d.ts", "export type * from './source/primitive.d.ts';"],
      [path.join("source", "primitive.d.ts"), "export type Primitive = string;"],
    ]);

    expect(declarationFiles({ library: "", typeFest }).map(({ path }) => path)).toEqual([
      "/node_modules/json-meta-client/index.d.ts",
      "/node_modules/type-fest/index.d.ts",
      "/node_modules/type-fest/source/primitive.d.ts",
    ]);
  });
});

describe(readDeclarations, () => {
  it("reads the built declaration and every type-fest declaration", async () => {
    const root = await fixture({
      "dist/index.d.mts": "export {};",
      "node_modules/type-fest/index.d.ts": "export type * from './source/primitive.d.ts';",
      "node_modules/type-fest/source/primitive.d.ts": "export type Primitive = string;",
      "node_modules/other/index.d.ts": "export {};",
    });

    const files = await readDeclarations(root);

    expect(files).toEqual([
      { path: "/node_modules/json-meta-client/index.d.ts", content: "export {};" },
      {
        path: "/node_modules/type-fest/index.d.ts",
        content: "export type * from './source/primitive.d.ts';",
      },
      {
        path: "/node_modules/type-fest/source/primitive.d.ts",
        content: "export type Primitive = string;",
      },
    ]);
  });

  it("explains how to produce the declaration when the build is missing", async () => {
    const root = await fixture({ "package.json": "{}" });

    await expect(readDeclarations(root)).rejects.toThrow(/pnpm build/);
  });
});
