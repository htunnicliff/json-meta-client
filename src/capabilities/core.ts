import type { BlobContracts, PushSubscriptionContracts } from "jmap-rfc-types/contracts";

import { defineCapability } from "../capability.ts";

export const core = defineCapability({
  urn: "urn:ietf:params:jmap:core",
  entities: ["Core", "Blob", "PushSubscription"],
}).withMethods<{
  Core: {
    get: Core.Get.Method;
  };
  Blob: {
    copy: BlobContracts.Copy.Method;
  };
  PushSubscription: {
    get: PushSubscriptionContracts.Get.Method;
    set: PushSubscriptionContracts.Set.Method;
  };
}>();

declare namespace Core {
  export namespace Get {
    type Args = Record<string, any>;

    type Result<A> = A;

    export type Method = <const A extends Args>(args: A) => Result<A>;
  }
}
