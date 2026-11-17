import type { OptionSet } from "./stored-options.ts";

/**
 * How the code editor behaves
 */
export interface CodeOptions {
  /** Format the code with Prettier before each run */
  formatOnRun: boolean;
  /** Wrap lines longer than the editor is wide */
  wrapLines: boolean;
}

/**
 * The code editor's options
 */
export const codeOptions: OptionSet<CodeOptions> = {
  defaults: { formatOnRun: true, wrapLines: false },
  labels: { formatOnRun: "Format on run", wrapLines: "Wrap long lines" },
  storageKey: "json-meta-client:playground:code",
};
