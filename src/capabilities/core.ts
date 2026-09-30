import type { BlobContracts, PushSubscriptionContracts } from "jmap-rfc-types/contracts";

import { defineCapability } from "../capability.ts";

export interface CoreEchoContract {
  input: Record<string, unknown>;
  output: this["input"];
}

export const core = defineCapability({
  urn: "urn:ietf:params:jmap:core",
  entities: ["Core", "Blob", "PushSubscription"],
}).withMethods<{
  Core: {
    echo: CoreEchoContract;
  };
  Blob: {
    copy: BlobContracts.Copy.Contract;
  };
  PushSubscription: {
    get: PushSubscriptionContracts.Get.Contract;
    set: PushSubscriptionContracts.Set.Contract;
  };
}>();
