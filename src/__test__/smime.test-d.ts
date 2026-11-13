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

import { mail } from "../capabilities/mail.ts";
import { smime } from "../capabilities/smime.ts";
import { JsonMetaClient } from "../index.ts";
import type { SmimeStatus } from "../rfc-types/mail/index.ts";

// cspell:words smime

const mailboxIds = { inbox: true as const };
const smimeFilter = { hasSmime: true };
const andFilter = {
  operator: "AND",
  conditions: [{ subject: "meeting" }, { hasSmime: true }],
} as const;
const nestedFilter = {
  operator: "OR",
  conditions: [{ operator: "NOT", conditions: [{ hasVerifiedSmime: true }] }],
} as const;

const mailOnly = new JsonMetaClient({
  auth: "token",
  sessionUrl: "https://example.test/jmap",
  capabilities: ["mail"],
});

describe("S/MIME on a mail-only client", () => {
  it("rejects S/MIME properties in Email/get", () => {
    // @ts-expect-error S/MIME properties need the smime capability.
    assertType(mailOnly.api.Email.get({ properties: ["subject", "smimeStatus"] }));
  });

  it("returns no S/MIME properties without a properties list", async () => {
    const all = await mailOnly.api.Email.get({ ids: ["e1"] });
    expectTypeOf(all.list[0]!).not.toHaveProperty("smimeStatus");
    expectTypeOf(all.list[0]!).not.toHaveProperty("smimeVerifiedAt");
    const nullProperties = await mailOnly.api.Email.get({ ids: ["e1"], properties: null });
    expectTypeOf(nullProperties.list[0]!).not.toHaveProperty("smimeStatus");
    expectTypeOf(nullProperties.list[0]!).not.toHaveProperty("smimeVerifiedAt");
  });

  it("rejects S/MIME filter conditions", () => {
    // @ts-expect-error S/MIME filters need the smime capability.
    assertType(mailOnly.api.Email.query({ filter: smimeFilter }));
    // @ts-expect-error S/MIME filters need the smime capability.
    assertType(mailOnly.api.Email.queryChanges({ sinceQueryState: "state", filter: smimeFilter }));
    // @ts-expect-error S/MIME filters need the smime capability.
    assertType(mailOnly.api.SearchSnippet.get({ emailIds: ["e1"], filter: smimeFilter }));
  });

  it("rejects S/MIME filter conditions mixed with base ones inside AND, OR and NOT", () => {
    assertType(
      mailOnly.api.Email.query({
        filter: {
          operator: "AND",
          // @ts-expect-error S/MIME filters need the smime capability.
          conditions: [{ subject: "meeting" }, { hasSmime: true }],
        },
      }),
    );
    assertType(
      mailOnly.api.Email.queryChanges({
        sinceQueryState: "state",
        filter: {
          operator: "OR",
          conditions: [
            { subject: "meeting" },
            // @ts-expect-error S/MIME filters need the smime capability, at any depth.
            { operator: "NOT", conditions: [{ hasSmime: true }] },
          ],
        },
      }),
    );
    assertType(
      mailOnly.api.SearchSnippet.get({
        emailIds: ["e1"],
        filter: {
          operator: "NOT",
          // @ts-expect-error S/MIME filters need the smime capability.
          conditions: [{ subject: "meeting" }, { hasVerifiedSmime: true }],
        },
      }),
    );
  });

  it("rejects S/MIME-only filter conditions inside operators", () => {
    // @ts-expect-error S/MIME filters need the smime capability.
    assertType(mailOnly.api.Email.query({ filter: andFilter }));
    // @ts-expect-error S/MIME filters need the smime capability, at any depth.
    assertType(mailOnly.api.Email.query({ filter: nestedFilter }));
  });

  it("rejects S/MIME properties in sort, Email/parse and Email/set", () => {
    // @ts-expect-error S/MIME properties are not sortable.
    assertType(mailOnly.api.Email.query({ sort: [{ property: "smimeStatus" }] }));
    // @ts-expect-error Email/parse does not return S/MIME properties.
    assertType(mailOnly.api.Email.parse({ blobIds: ["b1"], properties: ["smimeStatus"] }));
    // @ts-expect-error S/MIME properties are server-set.
    assertType(mailOnly.api.Email.set({ update: { e1: { smimeStatus: "signed" } } }));
    // @ts-expect-error S/MIME properties are server-set.
    assertType(mailOnly.api.Email.set({ create: { e1: { mailboxIds, smimeStatus: "signed" } } }));
  });
});

const withSmime = new JsonMetaClient({
  auth: "token",
  sessionUrl: "https://example.test/jmap",
  capabilities: ["mail", "smime"],
});

describe("S/MIME on a client configured with smime", () => {
  it("returns exactly the requested S/MIME properties, each nullable", async () => {
    const response = await withSmime.api.Email.get({
      ids: ["e1"],
      properties: ["smimeStatus", "smimeStatusAtDelivery", "smimeErrors", "smimeVerifiedAt"],
    });
    const email = response.list[0]!;
    expectTypeOf<keyof typeof email>().toEqualTypeOf<
      "id" | "smimeStatus" | "smimeStatusAtDelivery" | "smimeErrors" | "smimeVerifiedAt"
    >();
    expectTypeOf(email).toMatchObjectType<{
      id: string;
      smimeStatus: SmimeStatus | null;
      smimeStatusAtDelivery: SmimeStatus | null;
      smimeErrors: string[] | null;
      smimeVerifiedAt: string | null;
    }>();
    expectTypeOf(email.smimeStatus).toEqualTypeOf<SmimeStatus | null>();
    expectTypeOf(email.smimeErrors).toEqualTypeOf<string[] | null>();
    expectTypeOf(email.smimeVerifiedAt).toEqualTypeOf<string | null>();
  });

  it("returns no S/MIME properties without a properties list", async () => {
    const all = await withSmime.api.Email.get({ ids: ["e1"] });
    expectTypeOf(all.list[0]!).not.toHaveProperty("smimeStatus");
    expectTypeOf(all.list[0]!).not.toHaveProperty("smimeVerifiedAt");
    const nullProperties = await withSmime.api.Email.get({ ids: ["e1"], properties: null });
    expectTypeOf(nullProperties.list[0]!).not.toHaveProperty("smimeStatus");
  });

  it("mixes base and S/MIME properties in one selection", async () => {
    const response = await withSmime.api.Email.get({
      ids: ["e1"],
      properties: ["subject", "smimeStatus"],
    });
    const email = response.list[0]!;
    expectTypeOf<keyof typeof email>().toEqualTypeOf<"id" | "subject" | "smimeStatus">();
    expectTypeOf(email.subject).toEqualTypeOf<string | null>();
    expectTypeOf(email.smimeStatus).toEqualTypeOf<SmimeStatus | null>();
  });

  it("references S/MIME properties from an Email/get result", async () => {
    const emails = withSmime.api.Email.get({ ids: ["e1"], properties: ["smimeStatus"] });
    const ref = emails.resultRef("/list/*/smimeStatus");
    expectTypeOf(ref).toExtend<{ path: string }>();
    const echoed = await withSmime.api.Core.echo({ statuses: ref });
    expectTypeOf(echoed.statuses).toEqualTypeOf<Array<SmimeStatus | null>>();
  });

  it("accepts S/MIME filter conditions, including nested ones", () => {
    assertType(withSmime.api.Email.query({ filter: smimeFilter }));
    assertType(withSmime.api.Email.query({ filter: andFilter }));
    assertType(withSmime.api.Email.query({ filter: nestedFilter }));
    assertType(
      withSmime.api.Email.queryChanges({ sinceQueryState: "state", filter: nestedFilter }),
    );
    assertType(withSmime.api.SearchSnippet.get({ emailIds: ["e1"], filter: andFilter }));
    assertType(
      withSmime.api.Email.query({
        filter: {
          operator: "OR",
          conditions: [
            { subject: "meeting" },
            { operator: "NOT", conditions: [{ hasSmime: true }] },
          ],
        },
      }),
    );
    assertType(withSmime.api.Email.query({ filter: { hasSmime: true } }));
    assertType(
      withSmime.api.Email.query({
        filter: {
          operator: "OR",
          conditions: [
            { hasVerifiedSmime: true },
            { operator: "NOT", conditions: [{ hasSmime: false }] },
          ],
        },
      }),
    );
    assertType(
      withSmime.api.Email.queryChanges({
        sinceQueryState: "state",
        filter: { operator: "AND", conditions: [{ hasSmime: true }, { subject: "meeting" }] },
      }),
    );
    assertType(
      withSmime.api.SearchSnippet.get({
        emailIds: ["e1"],
        filter: { hasVerifiedSmime: true },
      }),
    );
  });

  it("still rejects S/MIME properties in sort, Email/parse and Email/set", () => {
    // @ts-expect-error S/MIME properties are not sortable.
    assertType(withSmime.api.Email.query({ sort: [{ property: "smimeStatus" }] }));
    // @ts-expect-error Email/parse does not return S/MIME properties.
    assertType(withSmime.api.Email.parse({ blobIds: ["b1"], properties: ["smimeStatus"] }));
    // @ts-expect-error S/MIME properties are server-set.
    assertType(withSmime.api.Email.set({ update: { e1: { smimeStatus: "signed" } } }));
    // @ts-expect-error S/MIME properties are server-set.
    assertType(withSmime.api.Email.set({ create: { e1: { mailboxIds, smimeStatus: "signed" } } }));
  });
});

describe("S/MIME client configuration", () => {
  it("keeps two differently configured clients independent", () => {
    // @ts-expect-error The mail-only client is unaffected by the smime client above.
    assertType(mailOnly.api.Email.get({ properties: ["smimeStatus"] }));
    assertType(withSmime.api.Email.get({ properties: ["smimeStatus"] }));
  });

  it("gives the same API for any order, and for names or objects", () => {
    const reversed = new JsonMetaClient({
      auth: "token",
      sessionUrl: "https://example.test/jmap",
      capabilities: ["smime", "mail"],
    });
    const objects = new JsonMetaClient({
      auth: "token",
      sessionUrl: "https://example.test/jmap",
      capabilities: [mail, smime],
    });
    expectTypeOf(reversed.api).toEqualTypeOf(withSmime.api);
    expectTypeOf(objects.api).toEqualTypeOf(withSmime.api);
  });
});
