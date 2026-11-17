/* oxlint-disable typescript/no-explicit-any, typescript/no-unsafe-type-assertion */
import * as library from "../../../src/index.ts";
import { fillPlaceholders } from "./placeholders.ts";

export * from "../../../src/index.ts";

/**
 * The library's client, with the placeholders of its options filled in, so
 * docs examples that construct a client with `<server>` run in the docs build
 */
export const JsonMetaClient = class extends library.JsonMetaClient<any, any> {
  constructor(options: library.Config<any>) {
    super(fillPlaceholders(options));
  }
} as typeof library.JsonMetaClient;
