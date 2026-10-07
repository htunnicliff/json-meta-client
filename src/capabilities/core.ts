import type {
  BlobContracts,
  CoreContracts,
  PushSubscriptionContracts,
} from "jmap-rfc-types/contracts";

import type { Capability } from "../capability.ts";

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
  "urn:ietf:params:jmap:core"
> = {
  urn: "urn:ietf:params:jmap:core",
  entities: ["Core", "Blob", "PushSubscription"],
};
