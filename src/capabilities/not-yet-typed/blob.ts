import type { GetArguments, GetResponse } from "jmap-rfc-types";

import type { Capability } from "../../capability.ts";

export const blob: Capability<
  "Blob",
  {
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
  },
  "urn:ietf:params:jmap:blob"
> = {
  urn: "urn:ietf:params:jmap:blob",
  entities: ["Blob"],
};
