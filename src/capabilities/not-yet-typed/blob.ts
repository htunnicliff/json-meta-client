import type { GetArguments, GetResponse } from "jmap-rfc-types";

import { defineCapability } from "../../capability.ts";

export const blob = defineCapability({
  urn: "urn:ietf:params:jmap:blob",
  entities: ["Blob"],
}).withMethods<{
  Blob: {
    upload: {
      input: any;
      output: any;
    };
    get: {
      input: GetArguments<Blob>;
      output: GetResponse<Blob, any>;
    };
    lookup: {
      input: any;
      output: any;
    };
  };
}>();
