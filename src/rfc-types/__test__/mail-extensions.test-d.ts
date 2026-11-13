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

import type { AccountCapabilities, SessionCapabilities } from "../extensions.ts";
import type {
  Disposition,
  EmailGet,
  EmailQuery,
  EmailSmimeFilter,
  EmailSmimeProperties,
  EmailQueryChanges,
  MDN,
  MDNParse,
  MDNSend,
  SieveScriptGet,
  SieveScriptQuery,
  SieveScriptSet,
  SieveScriptValidate,
  SmimeStatus,
  WritableMDN,
  WritableSieveScript,
} from "../mail/index.ts";

// cspell:words mdnsent smime smimeverify

describe("mail extension capabilities", () => {
  it("advertises MDN, S/MIME verification, and Sieve metadata", () => {
    assertType<SessionCapabilities["urn:ietf:params:jmap:mdn"]>({});
    assertType<AccountCapabilities["urn:ietf:params:jmap:mdn"]>({});
    assertType<SessionCapabilities["urn:ietf:params:jmap:smimeverify"]>({});
    assertType<AccountCapabilities["urn:ietf:params:jmap:smimeverify"]>({});
    assertType<SessionCapabilities["urn:ietf:params:jmap:sieve"]>({
      implementation: "Example Sieve 1.0",
    });
    assertType<AccountCapabilities["urn:ietf:params:jmap:sieve"]>({
      maxSizeScriptName: 512,
      maxSizeScript: null,
      maxNumberScripts: null,
      maxNumberRedirects: null,
      sieveExtensions: [],
      notificationMethods: null,
      externalLists: null,
    });
  });
});

describe("RFC 9007 MDN types", () => {
  it("requires an email and disposition when sending and accepts email keyword patches", () => {
    assertType<MDNSend.Contract["input"]>({
      accountId: "account",
      identityId: "identity",
      send: {
        receipt: {
          forEmailId: "email",
          disposition: {
            actionMode: "manual-action",
            sendingMode: "mdn-sent-manually",
            type: "displayed",
          },
          extensionFields: { "X-Example": "value" },
        },
      },
      onSuccessUpdateEmail: { "#receipt": { "keywords/$mdnsent": true } },
    });
    expectTypeOf<{ disposition: Disposition }>().not.toExtend<WritableMDN>();
    expectTypeOf<{ forEmailId: string }>().not.toExtend<WritableMDN>();
    expectTypeOf<{
      forEmailId: null;
      disposition: Disposition;
    }>().not.toExtend<WritableMDN>();
    expectTypeOf<WritableMDN & { originalMessageId: string }>().toBeNever();
    // @ts-expect-error RFC 9007 section 2 defines lowercase disposition tokens.
    assertType<Disposition["type"]>("Displayed");
    type EmailPatch = NonNullable<MDNSend.Input["onSuccessUpdateEmail"]>[string];
    // @ts-expect-error Original email content cannot be changed after sending an MDN.
    assertType<EmailPatch>({ subject: "Changed" });
  });

  it("returns only server-supplied properties for sent MDNs", () => {
    assertType<MDNSend.Contract["output"]>({
      accountId: "account",
      sent: { receipt: { finalRecipient: "rfc822; me@example.com", originalMessageId: "id" } },
    });
    assertType<MDNSend.Output>({
      accountId: "account",
      sent: null,
      notSent: { receipt: { type: "mdnAlreadySent" } },
    });
  });

  it("allows parsing without a matching email and nullable result maps", () => {
    assertType<MDNParse.Contract["input"]>({ accountId: "account", blobIds: ["blob"] });
    expectTypeOf<MDN["forEmailId"]>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<NonNullable<MDNParse.Output["parsed"]>[string]>().toEqualTypeOf<MDN>();
    assertType<MDNParse.Contract["output"]>({
      accountId: "account",
      parsed: null,
      notParsable: ["invalid"],
      notFound: ["missing"],
    });
  });
});

describe("RFC 9219 S/MIME types", () => {
  it("returns explicitly requested signature properties with their nullable types", () => {
    assertType<EmailGet.Input<EmailSmimeProperties>>({
      accountId: "account",
      properties: ["smimeStatus", "smimeStatusAtDelivery", "smimeErrors", "smimeVerifiedAt"],
    });
    assertType<EmailGet.Input>({
      accountId: "account",
      // @ts-expect-error Base Email/get input has no S/MIME properties.
      properties: ["smimeStatus"],
    });
    type Email = EmailGet.Output<
      {
        properties: readonly [
          "smimeStatus",
          "smimeStatusAtDelivery",
          "smimeErrors",
          "smimeVerifiedAt",
        ];
      },
      EmailSmimeProperties
    >["list"][number];
    expectTypeOf<Email>().toMatchObjectType<{
      id: string;
      smimeStatus: SmimeStatus | null;
      smimeStatusAtDelivery: SmimeStatus | null;
      smimeErrors: string[] | null;
      smimeVerifiedAt: string | null;
    }>();
    expectTypeOf<keyof Email>().toEqualTypeOf<
      "id" | "smimeStatus" | "smimeStatusAtDelivery" | "smimeErrors" | "smimeVerifiedAt"
    >();
    assertType<SmimeStatus>("signed/verified");
    assertType<SmimeStatus>("future-extension/status");
    // @ts-expect-error Signature status is a string token.
    assertType<SmimeStatus>(true);
  });

  it("excludes signature properties from default Email/get results", () => {
    type Email = EmailGet.Output<{}, EmailSmimeProperties>["list"][number];
    expectTypeOf<Email>().not.toHaveProperty("smimeStatus");
    expectTypeOf<Email>().not.toHaveProperty("smimeStatusAtDelivery");
    expectTypeOf<Email>().not.toHaveProperty("smimeErrors");
    expectTypeOf<Email>().not.toHaveProperty("smimeVerifiedAt");
    expectTypeOf<
      EmailGet.Output<{ properties: null }, EmailSmimeProperties>["list"][number]
    >().toEqualTypeOf<Email>();
  });

  it("accepts signature conditions in email queries and nested query filters", () => {
    assertType<EmailQuery.Input<EmailSmimeFilter>>({
      accountId: "account",
      filter: { hasSmime: false },
    });
    // @ts-expect-error Base Email/query input has no S/MIME filter conditions.
    assertType<EmailQuery.Input>({ accountId: "account", filter: { hasSmime: false } });
    assertType<EmailQueryChanges.Input<EmailSmimeFilter>>({
      accountId: "account",
      sinceQueryState: "state",
      filter: {
        operator: "AND",
        conditions: [{ hasVerifiedSmime: true }, { subject: "meeting" }],
      },
    });
  });
});

describe("RFC 9661 Sieve types", () => {
  it("fetches all scripts or selected properties with the id always returned", () => {
    assertType<SieveScriptGet.Input>({ accountId: "account", ids: null, properties: null });
    expectTypeOf<
      SieveScriptGet.Output<{ properties: readonly ["name", "isActive"] }>["list"][number]
    >().toEqualTypeOf<{ id: string; name: string | null; isActive: boolean }>();
  });

  it("activates scripts through method arguments and allows partial updates", () => {
    assertType<SieveScriptSet.Contract["input"]>({
      accountId: "account",
      create: { script: { blobId: "blob" } },
      update: { existing: { name: null } },
      onSuccessActivateScript: "#script",
      onSuccessDeactivateScript: true,
    });
    expectTypeOf<{}>().not.toExtend<WritableSieveScript>();
    expectTypeOf<{ blobId: string; isActive: boolean }>().not.toExtend<WritableSieveScript>();
    expectTypeOf<{ blobId: string; id: string }>().not.toExtend<WritableSieveScript>();
    type Update = NonNullable<SieveScriptSet.Input["update"]>[string];
    // @ts-expect-error Activation is server-set and cannot be patched directly.
    assertType<Update>({ isActive: true });
    // @ts-expect-error Script ids cannot be changed.
    assertType<Update>({ id: "replacement" });
    // @ts-expect-error Activation accepts an Id, not Id|null.
    assertType<SieveScriptSet.Input>({ accountId: "account", onSuccessActivateScript: null });
    assertType<SieveScriptSet.Output>({
      accountId: "account",
      newState: "state",
      updated: { existing: { isActive: false } },
      notCreated: { script: { type: "invalidSieve", description: "Invalid script at line 1" } },
    });
  });

  it("queries scripts by name and activation status", () => {
    assertType<SieveScriptQuery.Contract["input"]>({
      accountId: "account",
      filter: { operator: "OR", conditions: [{ name: "work" }, { isActive: true }] },
      sort: [{ property: "name" }, { property: "isActive", isAscending: false }],
    });
    assertType<SieveScriptQuery.Input>({ accountId: "account", filter: {} });
  });

  it("validates uploaded script blobs and returns nullable validation errors", () => {
    assertType<SieveScriptValidate.Contract["input"]>({ accountId: "account", blobId: "blob" });
    assertType<SieveScriptValidate.Contract["output"]>({ accountId: "account", error: null });
    assertType<SieveScriptValidate.Output>({
      accountId: "account",
      error: { type: "invalidSieve", description: "Invalid script at line 1" },
    });
  });
});
