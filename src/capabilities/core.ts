import type { BlobContracts } from "jmap-rfc-types";

import { defineCapability } from "../capability.ts";

export const core = defineCapability({
  urn: "urn:ietf:params:jmap:core",
  entities: ["Core", "Blob"],
}).withMethods<{
  Core: {
    get: Core.Get.Method;
  };
  Blob: {
    copy: BlobContracts.Copy.Method;
  };
}>();

declare namespace Core {
  export namespace Get {
    type Args = Record<string, any>;

    type Result<A> = A;

    export type Method = <const A extends Args>(args: A) => Result<A>;
  }
}
