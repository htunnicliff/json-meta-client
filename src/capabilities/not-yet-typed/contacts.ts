import type {
  ChangesArguments,
  ChangesResponse,
  CopyArguments,
  CopyResponse,
  GetArguments,
  GetResponse,
  QueryArguments,
  QueryChangesArguments,
  QueryChangesResponse,
  QueryResponse,
  SetArguments,
  SetResponse,
} from "jmap-rfc-types";

import type { Capability } from "../../capability.ts";

export const contacts: Capability<
  "AddressBook" | "ContactCard",
  {
    AddressBook: {
      get: {
        input: GetArguments<any>;
        output: GetResponse<any, any>;
      };
      changes: {
        input: ChangesArguments;
        output: ChangesResponse;
      };
      set: {
        input: SetArguments<any>;
        output: SetResponse<any, any>;
      };
    };
    ContactCard: {
      get: {
        input: GetArguments<any>;
        output: GetResponse<any, any>;
      };
      changes: {
        input: ChangesArguments;
        output: ChangesResponse;
      };
      query: {
        input: QueryArguments<any>;
        output: QueryResponse;
      };
      queryChanges: {
        input: QueryChangesArguments<any, any>;
        output: QueryChangesResponse;
      };
      set: {
        input: SetArguments<any>;
        output: SetResponse<any, any>;
      };
      copy: {
        input: CopyArguments<any>;
        output: CopyResponse<any>;
      };
    };
  },
  "urn:ietf:params:jmap:contacts"
> = {
  urn: "urn:ietf:params:jmap:contacts",
  entities: ["AddressBook", "ContactCard"],
};
