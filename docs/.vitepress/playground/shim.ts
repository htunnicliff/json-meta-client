/* oxlint-disable typescript/no-explicit-any, typescript/no-unsafe-type-assertion */
import { BUILT_IN_CAPABILITIES } from "../../../src/built-ins.ts";
import * as library from "../../../src/index.ts";

const builtInUrns = new Set<string>(Object.values(BUILT_IN_CAPABILITIES).map(({ urn }) => urn));

/**
 * The URNs a client configured with these capabilities sends that no built-in
 * capability provides
 */
function customUrns(capabilities: unknown): string[] {
  if (!Array.isArray(capabilities)) return [];
  return capabilities
    .filter((capability): capability is library.Capability =>
      Boolean(capability && typeof capability === "object" && "urn" in capability),
    )
    .flatMap(({ urn, dependsOn = [] }) => [urn].concat(dependsOn))
    .filter((urn) => !builtInUrns.has(urn));
}

/**
 * The library as the user's code sees it. Its `JsonMetaClient` reports the
 * URNs of custom capabilities before the client fetches a Session, so the
 * placeholder Session can include them and the client has no capability
 * mismatch to warn about. With `substitute`, it also replaces the
 * `sessionUrl` and `auth` of each client with a connected server's.
 */
export function createShim(
  reportUrns: (urns: string[]) => void,
  substitute?: Pick<library.Config<any>, "sessionUrl" | "auth">,
): typeof library {
  class JsonMetaClient extends library.JsonMetaClient<any, any> {
    constructor(options: library.Config<any>) {
      const urns = customUrns(options?.capabilities);
      if (urns.length) reportUrns(urns);
      super(substitute ? { ...options, ...substitute } : options);
    }
  }
  return { ...library, JsonMetaClient: JsonMetaClient as typeof library.JsonMetaClient };
}
