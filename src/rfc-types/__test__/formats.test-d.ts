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
  Address,
  Anniversary,
  Author,
  Calendar,
  Card,
  CardV1,
  CardV2,
  Directory,
  Media,
  Name,
  OnlineService,
  Organization,
  Phone,
  Relation,
  SpeakToAs,
} from "../formats/index.ts";

// cspell:words dʒeɪn xmpp Ingénieure

describe("RFC 9553 and RFC 9982 JSContact types", () => {
  it("requires Card metadata and permits omitted optional properties", () => {
    assertType<Card>({ "@type": "Card", version: "1.0", uid: "contact" });
    // @ts-expect-error The topmost Card must explicitly identify its type.
    assertType<Card>({ version: "1.0", uid: "contact" });
    // @ts-expect-error The JSContact version is mandatory.
    assertType<Card>({ "@type": "Card", uid: "contact" });
    // @ts-expect-error A version 1.0 Card must have a uid.
    assertType<Card>({ "@type": "Card", version: "1.0" });
  });

  it("accepts version 2.0 Cards with or without a uid", () => {
    assertType<Card>({ "@type": "Card", version: "2.0" });
    assertType<Card>({ "@type": "Card", version: "2.0", uid: "contact" });
    // @ts-expect-error An optional uid must still be a string when present.
    assertType<Card>({ "@type": "Card", version: "2.0", uid: null });
    // @ts-expect-error Only the registered versions 1.0 and 2.0 are supported.
    assertType<Card>({ "@type": "Card", version: "3.0", uid: "contact" });
  });

  it("shares all contact properties between the explicit Card versions", () => {
    const legacy: CardV1 = {
      "@type": "Card",
      version: "1.0",
      uid: "contact",
      name: { full: "Jane Doe" },
      "example.com:custom": { enabled: true },
    };
    assertType<Card>(legacy);
    assertType<CardV2>({ ...legacy, version: "2.0" });
    assertType<CardV2>({ "@type": "Card", version: "2.0" });
    // @ts-expect-error Explicit version 1.0 Cards still require a uid.
    assertType<CardV1>({ "@type": "Card", version: "1.0" });
    // @ts-expect-error A version 1.0 Card is not a version 2.0 Card.
    assertType<CardV2>(legacy);
  });

  it.each<Card>([
    { "@type": "Card", version: "1.0", uid: "contact" },
    { "@type": "Card", version: "2.0" },
  ])("narrows the uid type using Card version $version", (card) => {
    expectTypeOf(card.uid).toEqualTypeOf<string | undefined>();
    if (card.version === "1.0") {
      expectTypeOf(card).toEqualTypeOf<CardV1>();
      expectTypeOf(card.uid).toEqualTypeOf<string>();
    } else {
      expectTypeOf(card).toEqualTypeOf<CardV2>();
      expectTypeOf(card.uid).toEqualTypeOf<string | undefined>();
    }
  });

  it("supports structured contact information and localization patches", () => {
    assertType<Card>({
      "@type": "Card",
      version: "1.0",
      uid: "contact",
      name: {
        components: [
          { kind: "given", value: "Jane", phonetic: "/dʒeɪn/" },
          { kind: "surname", value: "Doe" },
        ],
        isOrdered: true,
        phoneticSystem: "ipa",
      },
      organizations: { work: { name: "Example", units: [{ name: "Engineering" }] } },
      titles: { role: { name: "Engineer", organizationId: "work" } },
      speakToAs: { pronouns: { p1: { pronouns: "she/her" } } },
      emails: { work: { address: "jane@example.com", contexts: { work: true }, pref: 1 } },
      phones: { mobile: { number: "tel:+15555555555", features: { voice: true, text: true } } },
      onlineServices: { chat: { uri: "xmpp:jane@example.com" } },
      preferredLanguages: { en: { language: "en", pref: 1 } },
      addresses: { home: { full: "Example Street", contexts: { delivery: true } } },
      calendars: { work: { kind: "freeBusy", uri: "https://example.com/busy" } },
      schedulingAddresses: { work: { uri: "mailto:jane@example.com" } },
      cryptoKeys: { key: { uri: "https://example.com/key" } },
      directories: { work: { kind: "entry", uri: "https://example.com/people/jane" } },
      links: { web: { uri: "https://example.com" } },
      media: { avatar: { kind: "photo", uri: "https://example.com/avatar.jpg" } },
      anniversaries: { birthday: { kind: "birth", date: { month: 4, day: 15 } } },
      keywords: { friend: true },
      notes: { note: { note: "Met at a conference", author: { name: "John" } } },
      personalInfo: { hobby: { kind: "hobby", value: "Reading", level: "high" } },
      localizations: {
        fr: {
          "titles/role/name": "Ingénieure",
          "name/components/0/value": "Jeanne",
          "name/components": [{ kind: "given", value: "Jeanne" }],
          "notes/note": null,
        },
      },
    });
  });

  it("permits implied nested types and validates explicit type names", () => {
    assertType<Name>({ full: "Jane Doe" });
    assertType<Name>({ "@type": "Name", full: "Jane Doe" });
    // @ts-expect-error A nested Name cannot identify itself as an Address.
    assertType<Name>({ "@type": "Address", full: "Jane Doe" });
  });

  it("requires identifying information for compound objects", () => {
    assertType<Organization>({ units: [{ name: "Engineering" }] });
    assertType<OnlineService>({ user: "jane" });
    assertType<Address>({ coordinates: "geo:37.386013,-122.082932" });
    assertType<SpeakToAs>({ grammaticalGender: "feminine" });
    assertType<Author>({ uri: "mailto:john@example.com" });
    // @ts-expect-error A Name requires full or components.
    assertType<Name>({});
    // @ts-expect-error An Organization requires name or units.
    assertType<Organization>({});
    // @ts-expect-error An OnlineService requires uri or user.
    assertType<OnlineService>({ service: "Example" });
    // @ts-expect-error An Address requires an address or location property.
    assertType<Address>({ contexts: { work: true } });
    // @ts-expect-error SpeakToAs requires grammaticalGender or pronouns.
    assertType<SpeakToAs>({});
    // @ts-expect-error An Author requires name or uri.
    assertType<Author>({});
  });

  it("requires true values in sets", () => {
    assertType<Card>({
      "@type": "Card",
      version: "1.0",
      uid: "group",
      kind: "group",
      members: { contact: true },
      relatedTo: { contact: { relation: { friend: true } } },
    });
    // @ts-expect-error Phone feature sets cannot contain false values.
    assertType<Phone>({ number: "555-5555", features: { voice: false } });
    // @ts-expect-error Relation sets cannot contain false values.
    assertType<Relation>({ relation: { friend: false } });
  });

  it("requires resource kinds where specified by the RFC", () => {
    // @ts-expect-error Calendar resources require a kind.
    assertType<Calendar>({ uri: "https://example.com/calendar" });
    // @ts-expect-error Directory resources require a kind.
    assertType<Directory>({ uri: "https://example.com/directory" });
    // @ts-expect-error Media resources require a kind.
    assertType<Media>({ uri: "https://example.com/photo.jpg" });
  });

  it("distinguishes anniversary partial dates from explicit timestamps", () => {
    assertType<Anniversary>({ kind: "birth", date: { year: 2000 } });
    assertType<Anniversary>({
      kind: "birth",
      date: { "@type": "Timestamp", utc: "2000-04-15T12:00:00Z" },
    });
    // @ts-expect-error Anniversary timestamps must explicitly identify their type.
    assertType<Anniversary>({ kind: "birth", date: { utc: "2000-04-15T12:00:00Z" } });
  });

  it("supports vendor properties and vendor enum values on nested objects", () => {
    assertType<Card>({
      "@type": "Card",
      version: "1.0",
      uid: "contact",
      kind: "example.com:custom",
      "example.com:custom": { enabled: true },
      name: { full: "Jane Doe", "example.com:custom": "value" },
      phones: {
        custom: {
          number: "555-5555",
          features: { "example.com:custom": true },
          contexts: { "example.com:custom": true },
        },
      },
    });
  });
});
