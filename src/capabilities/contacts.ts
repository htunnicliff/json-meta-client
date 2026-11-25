import type { Capability } from "../capability.ts";
import type {
  AddressBookGet,
  AddressBookChanges,
  AddressBookSet,
  ContactsAccountCapabilities,
  ContactCardGet,
  ContactCardChanges,
  ContactCardQuery,
  ContactCardQueryChanges,
  ContactCardSet,
  ContactCardCopy,
} from "../rfc-types/contacts/index.ts";

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
