/**
 * Copyright (c) 2026 Hunter Tunnicliff
 *
 * This source code is subject to the terms of the Mozilla Public
 * License, version 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 */

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

/**
 * Account limits and permissions advertised by the JMAP Contacts capability.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9610.html#section-1.4.1
 */
export interface ContactsAccountCapabilities {
  /** Maximum address books per card, or null for no separate limit. */
  maxAddressBooksPerCard: number | null;
  mayCreateAddressBook: boolean;
}

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
  "urn:ietf:params:jmap:contacts",
  ContactsAccountCapabilities
> = {
  urn: "urn:ietf:params:jmap:contacts",
  entities: ["AddressBook", "ContactCard"],
};
