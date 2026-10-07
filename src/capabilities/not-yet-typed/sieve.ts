import type {
  GetArguments,
  GetResponse,
  QueryArguments,
  QueryResponse,
  SetArguments,
  SetError,
  SetResponse,
} from "jmap-rfc-types";

import type { Capability } from "../../capability.ts";

export const sieve: Capability<
  "SieveScript",
  {
    SieveScript: {
      get: {
        input: GetArguments<any>;
        output: GetResponse<any, any>;
      };
      query: {
        input: QueryArguments<any>;
        output: QueryResponse;
      };
      set: {
        input: SetArguments<any>;
        output: SetResponse<any, any>;
      };
      validate: {
        input: {
          accountId: string;
          blobId: string;
        };
        output: {
          accountId: string;
          error: SetError<any> | null;
        };
      };
    };
  },
  "urn:ietf:params:jmap:sieve"
> = {
  urn: "urn:ietf:params:jmap:sieve",
  entities: ["SieveScript"],
};
