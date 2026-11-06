// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  AddressBook,
  AddressBookChanges,
  AddressBookGet,
  AddressBookSet,
  ContactCard,
  ContactCardChanges,
  ContactCardCopy,
  ContactCardGet,
  ContactCardMedia,
  ContactCardQuery,
  ContactCardQueryChanges,
  ContactCardSet,
  WritableAddressBook,
  WritableContactCard,
} from "../contacts/index.ts";
import type { AccountCapabilities, SessionCapabilities } from "../extensions.ts";

describe("RFC 9610 contacts types", () => {
  it("advertises contacts account limits and permissions", () => {
    assertType<SessionCapabilities["urn:ietf:params:jmap:contacts"]>({});
    assertType<AccountCapabilities["urn:ietf:params:jmap:contacts"]>({
      maxAddressBooksPerCard: null,
      mayCreateAddressBook: true,
    });
    assertType<AccountCapabilities["urn:ietf:params:jmap:contacts"]>({
      maxAddressBooksPerCard: 1,
      mayCreateAddressBook: false,
    });
  });

  it("fetches all address books or selects properties while always returning ids", () => {
    assertType<AddressBookGet.Contract["input"]>({ accountId: "account", ids: null });
    expectTypeOf<AddressBookGet.Output<{}>["list"][number]>().toEqualTypeOf<AddressBook>();
    expectTypeOf<
      AddressBookGet.Output<{ properties: readonly ["name", "myRights"] }>["list"][number]
    >().toEqualTypeOf<Pick<AddressBook, "id" | "name" | "myRights">>();
  });

  it("creates address books with defaults and changes sharing and the default book", () => {
    assertType<AddressBookSet.Contract["input"]>({
      accountId: "account",
      create: { personal: { name: "Personal" } },
      update: {
        shared: {
          description: null,
          "shareWith/principal": {
            mayRead: true,
            mayWrite: false,
            mayShare: false,
            mayDelete: false,
          },
          "shareWith/former": null,
          isSubscribed: true,
        },
      },
      destroy: ["old"],
      onDestroyRemoveContents: true,
      onSuccessSetIsDefault: "#personal",
    });
    assertType<AddressBookSet.Input>({ accountId: "account", onSuccessSetIsDefault: null });
    expectTypeOf<{}>().not.toExtend<WritableAddressBook>();
    expectTypeOf<WritableAddressBook & { isDefault: true }>().toBeNever();
    expectTypeOf<WritableAddressBook & { id: string }>().toBeNever();
    type Update = NonNullable<AddressBookSet.Input["update"]>[string];
    // @ts-expect-error isDefault is server-set; use onSuccessSetIsDefault instead.
    assertType<Update>({ isDefault: true });
    // @ts-expect-error The current user's rights are server-set.
    assertType<Update>({ "myRights/mayWrite": true });
    assertType<AddressBookSet.Contract["output"]>({
      accountId: "account",
      newState: "new",
      updated: { personal: { isDefault: true } },
      notDestroyed: { old: { type: "addressBookHasContents" } },
    });
  });

  it("preserves JSContact version rules and requires JMAP address book membership", () => {
    const card: ContactCard = {
      "@type": "Card",
      version: "1.0",
      uid: "urn:uuid:contact",
      id: "contact",
      addressBookIds: { personal: true },
      name: { full: "Jane Doe" },
      "example.com:custom": true,
    };
    assertType<ContactCard>({ ...card, version: "2.0", uid: undefined });
    assertType<WritableContactCard>({
      "@type": "Card",
      version: "2.0",
      addressBookIds: { personal: true },
    });
    expectTypeOf<WritableContactCard & { id: string }>().toBeNever();
    // @ts-expect-error Version 1.0 still requires a uid.
    assertType<WritableContactCard>({
      "@type": "Card",
      version: "1.0",
      addressBookIds: { personal: true },
    });
    // @ts-expect-error ContactCards must specify their address book membership.
    assertType<WritableContactCard>({ "@type": "Card", version: "2.0" });
    assertType<WritableContactCard>({
      "@type": "Card",
      version: "2.0",
      // @ts-expect-error Membership values must be true.
      addressBookIds: { personal: false },
    });
  });

  it("supports URI and blob media when creating and updating contacts", () => {
    assertType<ContactCardMedia>({ kind: "photo", uri: "https://example.com/photo.png" });
    assertType<ContactCardMedia>({ kind: "photo", blobId: "photo", mediaType: "image/png" });
    // @ts-expect-error A resource needs either a URI or a blob reference.
    assertType<ContactCardMedia>({ kind: "photo" });
    // @ts-expect-error Blob-only media needs a media type.
    assertType<ContactCardMedia>({ kind: "photo", blobId: "photo" });
    assertType<ContactCardSet.Contract["input"]>({
      accountId: "account",
      create: {
        jane: {
          "@type": "Card",
          version: "2.0",
          addressBookIds: { personal: true },
          media: { avatar: { kind: "photo", blobId: "photo", mediaType: "image/png" } },
        },
      },
      update: {
        jane: {
          "addressBookIds/shared": true,
          "addressBookIds/old": null,
          "media/avatar": { kind: "photo", blobId: "new-photo", mediaType: "image/jpeg" },
          "name/full": "Jane Doe",
        },
      },
    });
    type Update = NonNullable<ContactCardSet.Input["update"]>[string];
    // @ts-expect-error The ContactCard id is immutable and server-set.
    assertType<Update>({ id: "other" });
    // @ts-expect-error Membership patch values must be true or null.
    assertType<Update>({ "addressBookIds/personal": false });
    // @ts-expect-error Media replacements must identify a resource.
    assertType<Update>({ "media/avatar": { kind: "photo" } });
  });

  it("returns selected ContactCard properties including blob-backed media", () => {
    assertType<ContactCardGet.Contract["input"]>({
      accountId: "account",
      properties: ["name", "media"],
    });
    type Selected = ContactCardGet.Output<{ properties: readonly ["media"] }>["list"][number];
    expectTypeOf<keyof Selected>().toEqualTypeOf<"id" | "media">();
    assertType<Selected>({
      id: "contact",
      media: { avatar: { kind: "photo", blobId: "photo", mediaType: "image/png" } },
    });
  });

  it("filters by contact fields and sorts by name components in both query methods", () => {
    const sort = [{ property: "name/surname", isAscending: true, collation: "i;octet" }] as const;
    const filter = {
      operator: "AND",
      conditions: [
        { inAddressBook: "personal", "name/given": "Jane", "name/surname2": "Doe" },
        { operator: "NOT", conditions: [{ hasMember: "urn:uuid:other", kind: "group" }] },
        {
          uid: "urn:uuid:contact",
          createdBefore: "2026-11-06T00:00:00Z",
          updatedAfter: "2026-01-01T00:00:00Z",
        },
        {
          text: "Jane",
          nickname: "J",
          organization: "Example",
          email: "jane@example.com",
          phone: "555",
          onlineService: "chat",
          address: "Street",
          note: "Friend",
        },
      ],
    } as const;
    assertType<ContactCardQuery.Contract["input"]>({ accountId: "account", filter, sort });
    assertType<ContactCardQueryChanges.Contract["input"]>({
      accountId: "account",
      sinceQueryState: "state",
      filter,
      sort,
    });
    assertType<ContactCardQuery.Input>({
      accountId: "account",
      filter: {},
      sort: [
        { property: "created" },
        { property: "updated" },
        { property: "name/given" },
        { property: "name/surname2" },
      ],
    });
    assertType<ContactCardQuery.Input>({
      accountId: "account",
      // @ts-expect-error Contact filters use singular inAddressBook, unlike mail filters.
      filter: { inAddressBooks: ["personal"] },
    });
  });

  it("copies contacts with optional replacements and requires a source id", () => {
    assertType<ContactCardCopy.Contract["input"]>({
      fromAccountId: "source",
      accountId: "destination",
      create: { copy: { id: "contact", addressBookIds: { personal: true } } },
      onSuccessDestroyOriginal: true,
      destroyFromIfInState: "state",
    });
    type Copy = ContactCardCopy.Input["create"][string];
    // @ts-expect-error Copies require a source ContactCard id.
    assertType<Copy>({ addressBookIds: { personal: true } });
    assertType<ContactCardCopy.Contract["output"]>({
      fromAccountId: "source",
      accountId: "destination",
      newState: "new",
      created: { copy: { id: "copied" } },
    });
  });

  it("exposes standard change tracking for address books and contact cards", () => {
    assertType<AddressBookChanges.Contract["input"]>({ accountId: "account", sinceState: "old" });
    expectTypeOf<AddressBookChanges.Output>().toEqualTypeOf<ContactCardChanges.Output>();
    assertType<ContactCardChanges.Contract["input"]>({
      accountId: "account",
      sinceState: "old",
      maxChanges: 100,
    });
    assertType<ContactCardChanges.Contract["output"]>({
      accountId: "account",
      oldState: "old",
      newState: "new",
      hasMoreChanges: false,
      created: ["contact"],
      updated: [],
      destroyed: [],
    });
  });
});
