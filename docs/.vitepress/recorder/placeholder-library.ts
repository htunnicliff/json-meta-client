/* oxlint-disable typescript/no-explicit-any, typescript/no-unsafe-type-assertion */
import * as library from "../../../src/index.ts";
import { fillPlaceholders } from "./placeholders.ts";

export * from "../../../src/index.ts";

let generateMethodCallId: ((method: string) => string) | undefined;

/**
 * Give clients that do not generate their own method call ids this generator,
 * so docs examples show readable ids
 */
export function useMethodCallIds(generate: (method: string) => string): void {
  generateMethodCallId = generate;
}

/**
 * The library's client, with the placeholders of its options filled in, so
 * docs examples that construct a client with `<server>` run in the docs build
 */
export const JsonMetaClient = class extends library.JsonMetaClient<any, any> {
  constructor(options: library.Config<any>) {
    const filled = fillPlaceholders(options);
    filled.generateMethodCallId ??= generateMethodCallId;
    super(filled);
  }
} as typeof library.JsonMetaClient;
