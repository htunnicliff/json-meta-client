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
  EmailAddress,
  EmailAddressGroup,
  EmailBodyPartForArgs,
  EmailFilter,
  EmailGet,
  EmailParse,
  EmailSubmissionFilter,
  MailboxChanges,
  MailboxFilter,
} from "../mail/rfc8621-mail.ts";

describe("RFC 8621 mail types", () => {
  it("allows individual filter conditions and empty filters", () => {
    // Sections 2.3, 4.4.1, and 7.3 allow any condition property to be omitted.
    assertType<MailboxFilter>({ parentId: null });
    assertType<EmailFilter>({ subject: "meeting" });
    assertType<EmailSubmissionFilter>({ undoStatus: "pending" });
    assertType<EmailFilter>({});
  });

  it("returns nullable names on addresses and address groups", () => {
    // Sections 4.1.2.3 and 4.1.2.4 define a present String|null property.
    expectTypeOf<EmailAddress["name"]>().toEqualTypeOf<string | null>();
    expectTypeOf<EmailAddressGroup["name"]>().toEqualTypeOf<string | null>();
    assertType<EmailAddress>({ email: "jane@example.com", name: null });
    assertType<EmailAddressGroup>({ addresses: [], name: null });
  });

  it("accepts body header properties and returns explicitly requested fields", () => {
    // Sections 4.1.4 and 4.2 apply header:* syntax to body parts too.
    assertType<EmailGet.Input>({
      accountId: "account",
      bodyProperties: ["headers", "header:Content-Type", "subParts"] as const,
    });
    type Part = EmailBodyPartForArgs<{
      bodyProperties: readonly ["headers", "header:Content-Type", "subParts"];
    }>;
    expectTypeOf<Part["headers"]>().toEqualTypeOf<{ name: string; value: string }[]>();
    expectTypeOf<Part["header:Content-Type"]>().toBeUnknown();
    expectTypeOf<Part["subParts"]>().toEqualTypeOf<Part[] | null>();
    expectTypeOf<EmailBodyPartForArgs<{}>>().not.toHaveProperty("headers");
    expectTypeOf<EmailBodyPartForArgs<{}>>().not.toHaveProperty("header:Content-Type");
  });

  it("allows null get properties but requires arrays for body and parse properties", () => {
    // Sections 4.2 and 4.9 specify String[], with explicit defaults, for these arguments.
    assertType<EmailGet.Input>({ accountId: "account", properties: null });
    // @ts-expect-error bodyProperties is String[], not String[]|null.
    assertType<EmailGet.Input>({ accountId: "account", bodyProperties: null });
    // @ts-expect-error Email/parse properties is String[], not String[]|null.
    assertType<EmailParse.Input>({ accountId: "account", blobIds: [], properties: null });
    assertType<EmailParse.Input>({ accountId: "account", blobIds: [], properties: [] });
    type Parsed = NonNullable<
      EmailParse.Output<{ properties: readonly ["id", "threadId"] }>["parsed"]
    >[string];
    expectTypeOf<Parsed>().toEqualTypeOf<{ id: null; threadId: string | null }>();
  });

  it("limits Mailbox/changes updatedProperties to the four count properties", () => {
    // Section 2.2 returns null for changes to any other mailbox properties.
    assertType<MailboxChanges.Output["updatedProperties"]>(["totalEmails", "unreadThreads"]);
    // @ts-expect-error A name change cannot be represented by updatedProperties.
    assertType<MailboxChanges.Output["updatedProperties"]>(["name"]);
  });
});
