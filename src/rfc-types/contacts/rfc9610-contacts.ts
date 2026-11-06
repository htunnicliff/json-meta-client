// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { DistributedOmit } from "type-fest";

import type {
  Comparator,
  MethodChanges,
  MethodCopy,
  MethodGet,
  MethodQuery,
  MethodQueryChanges,
  MethodSet,
} from "../core/rfc8620-jmap.ts";
import type { Card, Media } from "../formats/rfc9553-jscontact.ts";

declare module "../extensions.js" {
  export interface SessionCapabilities {
    "urn:ietf:params:jmap:contacts": {};
  }

  export interface AccountCapabilities {
    "urn:ietf:params:jmap:contacts": {
      maxAddressBooksPerCard: number | null;
      mayCreateAddressBook: boolean;
    };
  }
}

/** @see https://www.rfc-editor.org/info/rfc9610/#section-2 */
export interface AddressBook {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isDefault: boolean;
  isSubscribed: boolean;
  shareWith: { [principalId: string]: AddressBookRights } | null;
  myRights: AddressBookRights;
}

/** @see https://www.rfc-editor.org/info/rfc9610/#section-2 */
export interface AddressBookRights {
  mayRead: boolean;
  mayWrite: boolean;
  mayShare: boolean;
  mayDelete: boolean;
}

export namespace AddressBookGet {
  /** @see https://www.rfc-editor.org/info/rfc9610/#section-2.1 */
  export interface Input extends MethodGet.Input<AddressBook> {}
  export interface Output<Args> extends MethodGet.Output<AddressBook, Args> {}
  export interface Contract {
    input: Input;
    output: Output<this["input"]>;
  }
}

export namespace AddressBookChanges {
  /** @see https://www.rfc-editor.org/info/rfc9610/#section-2.2 */
  export interface Input extends MethodChanges.Input {}
  export interface Output extends MethodChanges.Output {}
  export interface Contract {
    input: Input;
    output: Output;
  }
}

/** @see https://www.rfc-editor.org/info/rfc9610/#section-2 */
export type WritableAddressBook = Pick<AddressBook, "name"> &
  Partial<Pick<AddressBook, "description" | "sortOrder" | "isSubscribed" | "shareWith">> & {
    id?: never;
    isDefault?: never;
    myRights?: never;
  };

export namespace AddressBookSet {
  /** @see https://www.rfc-editor.org/info/rfc9610/#section-2.3 */
  export interface Input extends MethodSet.Input<
    AddressBook,
    WritableAddressBook,
    WritableAddressBook
  > {
    onDestroyRemoveContents?: boolean;
    onSuccessSetIsDefault?: string | null;
  }
  export interface Output extends MethodSet.Output<AddressBook> {}
  export interface Contract {
    input: Input;
    output: Output;
  }
}

/**
 * A Media resource may use a blobId instead of a URI. Blob-only resources must
 * include their media type so clients can identify the content before loading it.
 * @see https://www.rfc-editor.org/info/rfc9610/#section-3
 */
export type ContactCardMedia = Omit<Media, "uri"> &
  ({ uri: string; blobId?: string } | { uri?: string; blobId: string; mediaType: string });

/** @see https://www.rfc-editor.org/info/rfc9610/#section-3 */
export type ContactCard = DistributedOmit<Card, "media"> & {
  id: string;
  /** A nonempty set of AddressBook ids. */
  addressBookIds: { [id: string]: true };
  media?: { [id: string]: ContactCardMedia };
};

export namespace ContactCardGet {
  /** @see https://www.rfc-editor.org/info/rfc9610/#section-3.1 */
  export interface Input extends MethodGet.Input<ContactCard> {}
  export interface Output<Args> extends MethodGet.Output<ContactCard, Args> {}
  export interface Contract {
    input: Input;
    output: Output<this["input"]>;
  }
}

export namespace ContactCardChanges {
  /** @see https://www.rfc-editor.org/info/rfc9610/#section-3.2 */
  export interface Input extends MethodChanges.Input {}
  export interface Output extends MethodChanges.Output {}
  export interface Contract {
    input: Input;
    output: Output;
  }
}

/** @see https://www.rfc-editor.org/info/rfc9610/#section-3.3.1 */
export interface ContactCardFilter {
  inAddressBook?: string;
  uid?: string;
  hasMember?: string;
  kind?: string;
  createdBefore?: string;
  createdAfter?: string;
  updatedBefore?: string;
  updatedAfter?: string;
  text?: string;
  name?: string;
  "name/given"?: string;
  "name/surname"?: string;
  "name/surname2"?: string;
  nickname?: string;
  organization?: string;
  email?: string;
  phone?: string;
  onlineService?: string;
  address?: string;
  note?: string;
}

/** @see https://www.rfc-editor.org/info/rfc9610/#section-3.3.2 */
export type ContactCardComparator = Comparator<
  ContactCard & {
    "name/given": string;
    "name/surname": string;
    "name/surname2": string;
  }
>;

export namespace ContactCardQuery {
  /** @see https://www.rfc-editor.org/info/rfc9610/#section-3.3 */
  export interface Input extends Omit<MethodQuery.Input<ContactCard, ContactCardFilter>, "sort"> {
    sort?: readonly ContactCardComparator[] | null;
  }
  export interface Output extends MethodQuery.Output {}
  export interface Contract {
    input: Input;
    output: Output;
  }
}

export namespace ContactCardQueryChanges {
  /** @see https://www.rfc-editor.org/info/rfc9610/#section-3.4 */
  export interface Input extends Omit<
    MethodQueryChanges.Input<ContactCard, ContactCardFilter>,
    "sort"
  > {
    sort?: readonly ContactCardComparator[] | null;
  }
  export interface Output extends MethodQueryChanges.Output {}
  export interface Contract {
    input: Input;
    output: Output;
  }
}

/** @see https://www.rfc-editor.org/info/rfc9610/#section-3 */
export type WritableContactCard = DistributedOmit<ContactCard, "id"> & { id?: never };

export namespace ContactCardSet {
  /** @see https://www.rfc-editor.org/info/rfc9610/#section-3.5 */
  export interface Input extends MethodSet.Input<
    ContactCard,
    WritableContactCard,
    WritableContactCard
  > {}
  export interface Output extends MethodSet.Output<ContactCard> {}
  export interface Contract {
    input: Input;
    output: Output;
  }
}

export namespace ContactCardCopy {
  /** @see https://www.rfc-editor.org/info/rfc9610/#section-3.6 */
  export interface Input extends MethodCopy.Input<ContactCard> {}
  export interface Output extends MethodCopy.Output<ContactCard> {}
  export interface Contract {
    input: Input;
    output: Output;
  }
}
