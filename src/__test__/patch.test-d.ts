import { assertType, describe, expectTypeOf, it } from "vitest";

import { mail } from "../capabilities/index.ts";
import { JsonMetaClient } from "../client.ts";
import { patchMap } from "../patch.ts";
import type { PatchMapPath, PatchMapValue } from "../patch.ts";
import type { PatchObject } from "../rfc-types/core/index.ts";
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
