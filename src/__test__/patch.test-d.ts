import { assertType, describe, expectTypeOf, it } from "vitest";

import { mail } from "../capabilities/index.ts";
import { JsonMetaClient } from "../client.ts";
import { patch, patchMap } from "../patch.ts";
import type { PatchMapPath, PatchMapValue } from "../patch.ts";
import type { Patch, PatchObject, UpdatePatch } from "../rfc-types/core/index.ts";
import type { EmailUpdate } from "../rfc-types/mail/index.ts";

const client = new JsonMetaClient({
  auth: "<opaque-token>",
  sessionUrl: "https://example.test/.well-known/jmap",
  capabilities: [mail],
});

declare const emailId: string;
declare const inboxId: string;

type EmailPatch = PatchObject<EmailUpdate>;

describe(patchMap, () => {
  it("names the maps a patch type has", () => {
    expectTypeOf<PatchMapPath<EmailPatch>>().toEqualTypeOf<"keywords" | "mailboxIds">();
    expectTypeOf<PatchMapValue<EmailPatch, "mailboxIds">>().toEqualTypeOf<true | null>();
  });

  it("finds maps nested below other paths, and skips maps of objects", () => {
    interface Settings {
      byAccount: { [id: string]: { enabled: boolean } };
      limits: { perAccount: { [id: string]: number } };
    }
    type Patch = PatchObject<Settings>;
    expectTypeOf<PatchMapPath<Patch>>().toEqualTypeOf<"byAccount" | "limits/perAccount">();
    expectTypeOf<PatchMapValue<Patch, "limits/perAccount">>().toEqualTypeOf<number | null>();
    expectTypeOf<PatchMapValue<Patch, "byAccount">>().toEqualTypeOf<{ enabled: boolean } | null>();
  });

  it("checks the path and values against a /set call's patch type", () => {
    assertType(
      client.api.Email.set({
        update: {
          [emailId]: {
            ...patchMap("mailboxIds", { [inboxId]: null, archive: true }),
            ...patchMap("keywords", { $seen: true }),
            "keywords/$flagged": null,
          },
        },
      }),
    );
    assertType(
      client.api.Email.set({
        // @ts-expect-error - Email has no `mailboxIdz` map
        update: { [emailId]: patchMap("mailboxIdz", { [inboxId]: true }) },
      }),
    );
    assertType(
      client.api.Email.set({
        // @ts-expect-error - A mailbox membership can only be added with `true`
        update: { [emailId]: patchMap("mailboxIds", { [inboxId]: false }) },
      }),
    );
  });

  it("checks a patch declared with its type", () => {
    assertType<EmailPatch>(patchMap("mailboxIds", { [inboxId]: true }));
    // @ts-expect-error - `subject` is not a map
    assertType<EmailPatch>(patchMap("subject", { [inboxId]: true }));
  });

  it("accepts no path without a patch type to check it against", () => {
    // @ts-expect-error - Nothing says which patch this is for
    assertType(patchMap("mailboxIds", { [inboxId]: true }));
  });
});

declare const archiveId: string;

describe(patch, () => {
  it("accepts map entries by variable ID, with their value types", () => {
    assertType(
      client.api.Email.set({
        update: {
          [emailId]: {
            mailboxIds: patch({ [inboxId]: null, [archiveId]: true }),
            keywords: patch({ $seen: true, $flagged: null }),
          },
        },
      }),
    );
  });

  it("rejects a value the map doesn't accept", () => {
    assertType(
      client.api.Email.set({
        // @ts-expect-error - A mailbox membership can only be added with `true`
        update: { [emailId]: { mailboxIds: patch({ [inboxId]: false }) } },
      }),
    );
  });

  it("rejects a property the update type doesn't have", () => {
    assertType(
      client.api.Email.set({
        // @ts-expect-error - Email has no `mailboxIdz` property
        update: { [emailId]: { mailboxIdz: patch({ [inboxId]: true }) } },
      }),
    );
  });

  it("keeps a plain object as the whole new value, as in JMAP", () => {
    assertType(
      client.api.Email.set({
        update: { [emailId]: { mailboxIds: { [archiveId]: true } } },
      }),
    );
    assertType(
      client.api.Email.set({
        // @ts-expect-error - A whole map can't hold `null`; that takes patch()
        update: { [emailId]: { mailboxIds: { [inboxId]: null } } },
      }),
    );
  });

  it("mixes patch() with JSON Pointer paths and patchMap()", () => {
    assertType(
      client.api.Email.set({
        update: {
          [emailId]: {
            ...patchMap("mailboxIds", { [inboxId]: null }),
            "keywords/$seen": true,
            keywords: patch({ $flagged: true }),
          },
        },
      }),
    );
  });

  it("patches deeper levels only where patch() is nested", () => {
    interface Settings {
      display: { theme: "light" | "dark"; font: { size: number } };
      tags: string[];
    }
    expectTypeOf<{ display: Patch<{ font: Patch<{ size: 12 }> }> }>().toExtend<
      UpdatePatch<Settings>
    >();
    expectTypeOf<{ display: Patch<{ font: { size: 12 } }> }>().toExtend<UpdatePatch<Settings>>();
    // Without patch(), the font is a whole value, so it needs every property
    expectTypeOf<{ display: Patch<{ font: {} }> }>().not.toExtend<UpdatePatch<Settings>>();
    expectTypeOf<{ display: Patch<{ font: Patch<{ size: "12" }> }> }>().not.toExtend<
      UpdatePatch<Settings>
    >();
    // Arrays can only be set whole
    expectTypeOf<{ tags: Patch<{ 0: "a" }> }>().not.toExtend<UpdatePatch<Settings>>();
  });

  it("keeps JSON Pointer paths in their wire form", () => {
    interface Settings {
      display: { font: { size: number } };
    }
    expectTypeOf<{ "display/font": { size: 12 } }>().toExtend<UpdatePatch<Settings>>();
    expectTypeOf<{ "display/font": Patch<{ size: 12 }> }>().not.toExtend<UpdatePatch<Settings>>();
  });
});
