import { assertType, describe, expectTypeOf, it } from "vitest";

import { mail } from "../capabilities/index.ts";
import { JsonMetaClient } from "../client.ts";
import { patchMap, replace } from "../patch.ts";
import type { PatchMapPath, PatchMapValue } from "../patch.ts";
import type { PatchObject, Replace, UpdatePatch } from "../rfc-types/core/index.ts";
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

describe("nested patches", () => {
  it("accepts map entries by variable ID, with their value types", () => {
    assertType(
      client.api.Email.set({
        update: {
          [emailId]: {
            mailboxIds: { [inboxId]: null, [archiveId]: true },
            keywords: { $seen: true, $flagged: null },
          },
        },
      }),
    );
  });

  it("rejects a value the map doesn't accept", () => {
    assertType(
      client.api.Email.set({
        // @ts-expect-error - A mailbox membership can only be added with `true`
        update: { [emailId]: { mailboxIds: { [inboxId]: false } } },
      }),
    );
  });

  it("rejects a property the update type doesn't have", () => {
    assertType(
      client.api.Email.set({
        // @ts-expect-error - Email has no `mailboxIdz` property
        update: { [emailId]: { mailboxIdz: { [inboxId]: true } } },
      }),
    );
  });

  it("mixes nested patches with JSON Pointer paths and patchMap()", () => {
    assertType(
      client.api.Email.set({
        update: {
          [emailId]: {
            ...patchMap("mailboxIds", { [inboxId]: null }),
            "keywords/$seen": true,
            keywords: { $flagged: true },
          },
        },
      }),
    );
  });

  it("replaces a map whole with replace()", () => {
    assertType(
      client.api.Email.set({
        update: { [emailId]: { mailboxIds: replace({ [archiveId]: true }) } },
      }),
    );
    assertType(
      client.api.Email.set({
        // @ts-expect-error - The replaced map is checked too
        update: { [emailId]: { mailboxIds: replace({ [archiveId]: false }) } },
      }),
    );
  });

  it("patches nested objects at any depth", () => {
    interface Settings {
      display: { theme: "light" | "dark"; font: { size: number } };
      tags: string[];
    }
    expectTypeOf<{ display: { font: { size: 12 } } }>().toExtend<UpdatePatch<Settings>>();
    expectTypeOf<{ display: { font: { size: "12" } } }>().not.toExtend<UpdatePatch<Settings>>();
    expectTypeOf<{ display: Replace<Settings["display"]> }>().toExtend<UpdatePatch<Settings>>();
    // Arrays are atomic, so they can't be patched by index
    expectTypeOf<{ tags: { 0: "a" } }>().not.toExtend<UpdatePatch<Settings>>();
  });

  it("keeps JSON Pointer paths in their wire form", () => {
    interface Settings {
      display: { font: { size: number } };
    }
    // A path's value is the value sent, so it is whole and can't be replace()d
    expectTypeOf<{ "display/font": { size: 12 } }>().toExtend<UpdatePatch<Settings>>();
    expectTypeOf<{ "display/font": Replace<{ size: 12 }> }>().not.toExtend<UpdatePatch<Settings>>();
  });
});
