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
    get: CoreContracts.Get.Method;
  };
  Blob: {
    copy: BlobContracts.Copy.Method;
  };
  PushSubscription: {
    get: PushSubscriptionContracts.Get.Method;
    set: PushSubscriptionContracts.Set.Method;
  };
}>();
