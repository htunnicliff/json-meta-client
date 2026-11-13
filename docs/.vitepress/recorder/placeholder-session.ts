import { BUILT_IN_CAPABILITIES } from "../../../src/built-ins.ts";
import { core } from "../../../src/capabilities/core.ts";
import type { Session } from "../../../src/rfc-types/core/index.ts";

/**
 * The id of the only account in a placeholder Session, primary for every
 * capability.
 */
export const PLACEHOLDER_ACCOUNT_ID = "<account-id>";

/**
 * A Session for a server at `origin` that supports every built-in capability,
 * plus any `extraUrns`, with {@link PLACEHOLDER_ACCOUNT_ID} as each primary
 * account.
 */
export function placeholderSession(origin: string, extraUrns: readonly string[] = []): Session {
  const urns = [...Object.values(BUILT_IN_CAPABILITIES).map(({ urn }) => urn), ...extraUrns];
  const capabilities: Session["capabilities"] = {
    ...Object.fromEntries(urns.map((urn) => [urn, {}])),
    [core.urn]: {
      maxSizeUpload: 50_000_000,
      maxConcurrentUpload: 4,
      maxSizeRequest: 10_000_000,
      maxConcurrentRequests: 4,
      maxCallsInRequest: 16,
      maxObjectsInGet: 256,
      maxObjectsInSet: 128,
      collationAlgorithms: [],
    },
  };
  return {
    capabilities,
    accounts: {
      [PLACEHOLDER_ACCOUNT_ID]: {
        name: "Placeholder",
        isPersonal: true,
        isReadOnly: false,
        accountCapabilities: Object.fromEntries(urns.map((urn) => [urn, {}])),
      },
    },
    primaryAccounts: Object.fromEntries(urns.map((urn) => [urn, PLACEHOLDER_ACCOUNT_ID])),
    username: "<username>",
    apiUrl: `${origin}/jmap/api`,
    downloadUrl: `${origin}/jmap/download/{accountId}/{blobId}/{name}?type={type}`,
    uploadUrl: `${origin}/jmap/upload/{accountId}`,
    eventSourceUrl: `${origin}/jmap/eventsource/?types={types}&closeafter={closeafter}&ping={ping}`,
    state: "<session-state>",
  };
}
