import type { Capability } from "../../capability.ts";
import type {
  MethodChanges,
  MethodCopy,
  MethodGet,
  MethodQuery,
  MethodQueryChanges,
  MethodSet,
} from "../../standards-types/core/index.ts";

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
        input: MethodGet.Input<any>;
        output: MethodGet.Output<any, any>;
      };
      changes: {
        input: MethodChanges.Input;
        output: MethodChanges.Output;
      };
      set: {
        input: MethodSet.Input<any>;
        output: MethodSet.Output<any>;
      };
    };
    ContactCard: {
      get: {
        input: MethodGet.Input<any>;
        output: MethodGet.Output<any, any>;
      };
      changes: {
        input: MethodChanges.Input;
        output: MethodChanges.Output;
      };
      query: {
        input: MethodQuery.Input<any>;
        output: MethodQuery.Output;
      };
      queryChanges: {
        input: MethodQueryChanges.Input<any, any>;
        output: MethodQueryChanges.Output;
      };
      set: {
        input: MethodSet.Input<any>;
        output: MethodSet.Output<any>;
      };
      copy: {
        input: MethodCopy.Input<any>;
        output: MethodCopy.Output<any>;
      };
    };
  },
  "urn:ietf:params:jmap:contacts",
  ContactsAccountCapabilities
> = {
  urn: "urn:ietf:params:jmap:contacts",
  entities: ["AddressBook", "ContactCard"],
};
