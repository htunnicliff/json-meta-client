import type {
  BlobContracts,
  CoreContracts,
  PushSubscriptionContracts,
} from "jmap-rfc-types/contracts";

import type { Capability } from "../capability.ts";

/**
 * Server-wide limits and features advertised by the JMAP Core capability.
 *
 * @see https://www.rfc-editor.org/rfc/rfc8620.html#section-2
 */
export interface CoreSessionCapabilities {
  maxSizeUpload: number;
  maxConcurrentUpload: number;
  maxSizeRequest: number;
  maxConcurrentRequests: number;
  maxCallsInRequest: number;
  maxObjectsInGet: number;
  maxObjectsInSet: number;
  collationAlgorithms: string[];
}

export const core: Capability<
  "Core" | "Blob" | "PushSubscription",
  {
    Core: {
      get: CoreContracts.Get.Contract;
    };
    Blob: {
      copy: BlobContracts.Copy.Contract;
    };
    PushSubscription: {
      get: PushSubscriptionContracts.Get.Contract;
      set: PushSubscriptionContracts.Set.Contract;
    };
  },
  "urn:ietf:params:jmap:core",
  unknown,
  CoreSessionCapabilities
> = {
  urn: "urn:ietf:params:jmap:core",
  entities: ["Core", "Blob", "PushSubscription"],
};
