/* oxlint-disable unicorn/require-post-message-target-origin */
import { compile } from "./compile.ts";
import type { CompileRequest, CompileResult } from "./protocol.ts";

/**
 * Transpiles the user's code. It holds the TypeScript compiler, so it lives
 * as long as the page and the run workers stay small.
 */
self.addEventListener("message", ({ data: { id, source } }: MessageEvent<CompileRequest>) => {
  let result: CompileResult;
  try {
    result = { id, ...compile(source) };
  } catch (error) {
    result = { id, diagnostics: [{ message: String(error) }] };
  }
  self.postMessage(result);
});
