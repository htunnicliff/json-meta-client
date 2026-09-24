import type {
  BlobContracts,
  CoreContracts,
  PushSubscriptionContracts,
} from "jmap-rfc-types/contracts";

import { defineCapability } from "../capability.ts";

export const core = defineCapability({
  urn: "urn:ietf:params:jmap:core",
  entities: ["Core", "Blob", "PushSubscription"],
}).withMethods<{
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
}>();
