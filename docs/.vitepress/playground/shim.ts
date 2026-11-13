/**
 * The global the generated shim reads the library and its configuration hook
 * from
 */
export const shimGlobals = "__jsonMetaClientPlayground";

export interface ShimGlobals {
  /** Every runtime export of `json-meta-client` */
  library: Record<string, unknown>;
  /**
   * Report the URNs of capabilities that are not built in, so the placeholder
   * Session includes them
   */
  configure(capabilities: ReadonlyArray<unknown> | undefined): void;
}

/**
 * The source of the module that `json-meta-client` imports are rewritten to.
 *
 * The worker bundles the library itself, and a Blob module cannot import the
 * worker's modules by path, so the shim reads them from a global instead. It
 * re-exports every library export unchanged, except `JsonMetaClient`, whose
 * subclass reports custom capabilities before the Session fetch.
 */
export function shimSource(exportNames: readonly string[]): string {
  const names = exportNames
    .filter(
      (name) => name !== "JsonMetaClient" && name !== "default" && /^[A-Za-z_$][\w$]*$/.test(name),
    )
    .toSorted();
  return [
    `const runtime = globalThis[${JSON.stringify(shimGlobals)}];`,
    `const { ${names.join(", ")} } = runtime.library;`,
    `export { ${names.join(", ")} };`,
    "",
    "export class JsonMetaClient extends runtime.library.JsonMetaClient {",
    "  constructor(options) {",
    "    super(options);",
    "    runtime.configure(options?.capabilities);",
    "  }",
    "}",
    "",
  ].join("\n");
}
