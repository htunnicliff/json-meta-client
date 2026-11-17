import type { EditorBehavior } from "./editor.ts";
import type { OptionSet } from "./stored-options.ts";

/**
 * How the code editor behaves
 */
export interface CodeOptions extends EditorBehavior {
  /** Format the code with Prettier before each run */
  formatOnRun: boolean;
}

/**
 * The code editor's options
 */
export const codeOptions: OptionSet<CodeOptions> = {
  defaults: { formatOnRun: true, wrapLines: false, suggestions: true, typesOnHover: true },
  labels: {
    formatOnRun: "Format on run",
    wrapLines: "Wrap long lines",
    suggestions: "Suggest completions",
    typesOnHover: "Show types on hover",
  },
  storageKey: "json-meta-client:playground:code",
};
