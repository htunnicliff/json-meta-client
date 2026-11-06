// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { Capability } from "../capability.ts";
import type {
  AddressBookGet,
  AddressBookChanges,
  AddressBookSet,
  ContactCardGet,
  ContactCardChanges,
  ContactCardQuery,
  ContactCardQueryChanges,
  ContactCardSet,
  ContactCardCopy,
} from "../rfc-types/contacts/index.ts";
import type { AccountCapabilities } from "../rfc-types/extensions.ts";

/**
 * Account limits and permissions advertised by the JMAP Contacts capability.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9610.html#section-1.4.1
 */
export type ContactsAccountCapabilities = AccountCapabilities["urn:ietf:params:jmap:contacts"];

export const contacts: Capability<
  "AddressBook" | "ContactCard",
  {
    AddressBook: {
      get: AddressBookGet.Contract;
      changes: AddressBookChanges.Contract;
      set: AddressBookSet.Contract;
    };
    ContactCard: {
      get: ContactCardGet.Contract;
      changes: ContactCardChanges.Contract;
      query: ContactCardQuery.Contract;
      queryChanges: ContactCardQueryChanges.Contract;
      set: ContactCardSet.Contract;
      copy: ContactCardCopy.Contract;
    };
  },
  "urn:ietf:params:jmap:contacts",
  ContactsAccountCapabilities
> = {
  urn: "urn:ietf:params:jmap:contacts",
  entities: ["AddressBook", "ContactCard"],
};
