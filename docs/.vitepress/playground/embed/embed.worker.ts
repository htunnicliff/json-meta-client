import { createSystem, createVirtualTypeScriptEnvironment } from "@typescript/vfs";
import { createWorker } from "@valtown/codemirror-ts/worker";
import * as Comlink from "comlink";
import ts from "typescript";
import libFiles from "virtual:playground-libs";
import typeFiles from "virtual:playground-types";

import { compile } from "../compile.ts";
import { editorCompilerOptions } from "../editor-options.ts";

/**
 * The TypeScript of inline embeds, in one worker for every embed on a page:
 * a language service for CodeMirror, and the compiler the runner needs, so
 * the page loads TypeScript once
 */
const worker = {
  ...createWorker(() => {
    const files = new Map<string, string>();
    for (const [name, text] of Object.entries(libFiles)) files.set(`/${name}`, text);
    for (const [file, text] of Object.entries(typeFiles)) files.set(`/${file}`, text);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const options = { ...editorCompilerOptions } as unknown as ts.CompilerOptions;
    return createVirtualTypeScriptEnvironment(
      createSystem(files),
      ["/docs-client.ts"],
      ts,
      options,
    );
  }),
  compile,
};

export type EmbedWorker = typeof worker;

Comlink.expose(worker);
