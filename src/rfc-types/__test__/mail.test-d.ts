import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  EmailAddress,
  EmailAddressGroup,
  EmailBodyPartForArgs,
  EmailFilter,
  EmailForArgs,
  EmailGet,
  EmailHeaderValue,
  EmailParse,
  EmailSubmissionFilter,
  ReadableEmail,
  WritableEmail,
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
    expectTypeOf<Part["header:Content-Type"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Part["subParts"]>().toEqualTypeOf<Part[] | null>();
    expectTypeOf<EmailBodyPartForArgs<{}>>().not.toHaveProperty("headers");
    expectTypeOf<EmailBodyPartForArgs<{}>>().not.toHaveProperty("header:Content-Type");
  });

  it("types each parsed header form, with and without :all", () => {
    // Section 4.1.2 defines the forms; section 4.1.3 makes the value null when
    // the header is absent, or a list of every instance with :all.
    expectTypeOf<EmailHeaderValue<"header:X-Spam">>().toEqualTypeOf<string | null>();
    expectTypeOf<EmailHeaderValue<"header:X-Spam:all">>().toEqualTypeOf<string[]>();
    expectTypeOf<EmailHeaderValue<"header:X-Spam:asRaw">>().toEqualTypeOf<string | null>();
    expectTypeOf<EmailHeaderValue<"header:X-Spam:asRaw:all">>().toEqualTypeOf<string[]>();
    expectTypeOf<EmailHeaderValue<"header:Subject:asText">>().toEqualTypeOf<string | null>();
    expectTypeOf<EmailHeaderValue<"header:Subject:asText:all">>().toEqualTypeOf<string[]>();
    expectTypeOf<EmailHeaderValue<"header:To:asAddresses">>().toEqualTypeOf<
      EmailAddress[] | null
    >();
    expectTypeOf<EmailHeaderValue<"header:To:asAddresses:all">>().toEqualTypeOf<EmailAddress[][]>();
    expectTypeOf<EmailHeaderValue<"header:To:asGroupedAddresses">>().toEqualTypeOf<
      EmailAddressGroup[] | null
    >();
    expectTypeOf<EmailHeaderValue<"header:To:asGroupedAddresses:all">>().toEqualTypeOf<
      EmailAddressGroup[][]
    >();
    expectTypeOf<EmailHeaderValue<"header:References:asMessageIds">>().toEqualTypeOf<
      string[] | null
    >();
    expectTypeOf<EmailHeaderValue<"header:References:asMessageIds:all">>().toEqualTypeOf<
      (string[] | null)[]
    >();
    expectTypeOf<EmailHeaderValue<"header:Date:asDate">>().toEqualTypeOf<string | null>();
    expectTypeOf<EmailHeaderValue<"header:Date:asDate:all">>().toEqualTypeOf<(string | null)[]>();
    expectTypeOf<EmailHeaderValue<"header:List-Post:asURLs">>().toEqualTypeOf<string[] | null>();
    expectTypeOf<EmailHeaderValue<"header:List-Post:asURLs:all">>().toEqualTypeOf<
      (string[] | null)[]
    >();
  });

  it("types requested header properties exactly on Email/get results", () => {
    type Email = EmailForArgs<{
      properties: readonly ["header:X-Spam", "header:To:asAddresses", "header:Date:asDate:all"];
    }>;
    expectTypeOf<Email["header:X-Spam"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Email["header:To:asAddresses"]>().toEqualTypeOf<EmailAddress[] | null>();
    expectTypeOf<Email["header:Date:asDate:all"]>().toEqualTypeOf<(string | null)[]>();

    type Output = EmailGet.Output<{ properties: readonly ["header:Subject:asText"] }>;
    expectTypeOf<Output["list"][number]["header:Subject:asText"]>().toEqualTypeOf<string | null>();
  });

  it("types header properties that name a form on any Email", () => {
    expectTypeOf<ReadableEmail["header:Subject:asText"]>().toEqualTypeOf<string | null>();
    expectTypeOf<ReadableEmail["header:To:asAddresses:all"]>().toEqualTypeOf<EmailAddress[][]>();
  });

  it("accepts header properties in their parsed forms on create", () => {
    // Section 4.6 sets a header in any parsed form, or every instance with :all.
    assertType<WritableEmail>({
      mailboxIds: { inbox: true },
      "header:X-Spam": " no",
      "header:Subject:asText": "Hello",
      "header:To:asAddresses": [{ email: "jane@example.com", name: null }],
      "header:Comments:asText:all": ["first", "second"],
      "header:Date:asDate": "2026-11-25T16:00:00Z",
    });
    assertType<WritableEmail>({
      mailboxIds: { inbox: true },
      // @ts-expect-error asAddresses takes a list of addresses, not a string.
      "header:To:asAddresses": "jane@example.com",
    });
    assertType<WritableEmail>({
      mailboxIds: { inbox: true },
      // @ts-expect-error A header can't be written as null.
      "header:Subject:asText": null,
    });
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
