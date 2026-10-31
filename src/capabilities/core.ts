import type { Capability } from "../capability.ts";
import type * as Standard from "../standards-types/core/index.ts";

/**
 * Server-wide limits and features advertised by the JMAP Core capability.
 *
 * @see https://www.rfc-editor.org/rfc/rfc8620.html#section-2
 */
type Details = Standard.SessionCapabilities["urn:ietf:params:jmap:core"];
export interface CoreSessionCapabilities extends Details {}

export const core: Capability<
  "Core" | "Blob" | "PushSubscription",
  {
    Core: {
      echo: Standard.CoreEcho.Contract;
    };
    Blob: {
      copy: Standard.BlobCopy.Contract;
    };
    PushSubscription: {
      get: Standard.PushSubscriptionGet.Contract;
      set: Standard.PushSubscriptionSet.Contract;
    };
  },
  "urn:ietf:params:jmap:core",
  unknown,
  CoreSessionCapabilities
> = {
  urn: "urn:ietf:params:jmap:core",
  entities: ["Core", "Blob", "PushSubscription"],
};
