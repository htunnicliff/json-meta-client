/* oxlint-disable typescript/no-explicit-any, typescript/no-unsafe-type-assertion */
import { BUILT_IN_CAPABILITIES } from "../../../src/built-ins.ts";
import * as library from "../../../src/index.ts";
import { fillPlaceholders } from "../recorder/index.ts";
import type { PlaceholderServer } from "../recorder/index.ts";
import { hookObservers } from "./hook-trace.ts";
import type { ObserveHooks } from "./hook-trace.ts";

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
 * mismatch to warn about. It also fills in the placeholders of each
 * client's options, with a connected server when there is one.
 */
export function createShim(
  reportUrns: (urns: string[]) => void,
  server?: PlaceholderServer,
  instrumentation?: {
    Client: typeof library.JsonMetaClient;
    observeHooks: ObserveHooks;
    /** Readable method call ids, for clients that do not generate their own */
    generateMethodCallId?: (method: string) => string;
  },
): typeof library {
  const Client = instrumentation?.Client ?? library.JsonMetaClient;
  class JsonMetaClient extends Client<any, any> {
    constructor(options: library.Config<any>) {
      const urns = customUrns(options?.capabilities);
      if (urns.length) reportUrns(urns);
      const filled = fillPlaceholders(options, server);
      if (instrumentation?.generateMethodCallId && !filled.generateMethodCallId) {
        filled.generateMethodCallId = instrumentation.generateMethodCallId;
      }
      if (instrumentation && filled.hooks) hookObservers.set(filled, instrumentation.observeHooks);
      super(filled);
    }
  }
  return { ...library, JsonMetaClient: JsonMetaClient as typeof library.JsonMetaClient };
}
