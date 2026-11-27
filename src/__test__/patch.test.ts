import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mail } from "../capabilities/mail.ts";
import { submission } from "../capabilities/submission.ts";
import { JsonMetaClient } from "../client.ts";
import { flattenPatch, patch, patchMap } from "../patch.ts";
import type { PatchObject } from "../rfc-types/core/index.ts";
import type { EmailUpdate } from "../rfc-types/mail/index.ts";

describe(patchMap, () => {
  it("makes one patch path per key", () => {
    const patch: PatchObject<EmailUpdate> = patchMap("mailboxIds", { inbox: null, archive: true });
    expect(patch).toEqual({ "mailboxIds/inbox": null, "mailboxIds/archive": true });
  });

  it("escapes each key as a JSON Pointer segment", () => {
    const patch: PatchObject<EmailUpdate> = patchMap("keywords", { "a~b/c": true });
    expect(patch).toEqual({ "keywords/a~0b~1c": true });
  });

  it("returns an empty patch for no entries", () => {
    const patch: PatchObject<EmailUpdate> = patchMap("mailboxIds", {});
    expect(patch).toEqual({});
  });
});

describe(flattenPatch, () => {
  it("sends each key of a patch() as a JSON Pointer path", () => {
    expect(
      flattenPatch({
        mailboxIds: patch({ inbox: null, archive: true }),
        keywords: patch({ $seen: true }),
      }),
    ).toEqual({ "mailboxIds/inbox": null, "mailboxIds/archive": true, "keywords/$seen": true });
  });

  it("sends plain objects and other values whole, as in JMAP", () => {
    expect(
      flattenPatch({ mailboxIds: { archive: true }, bcc: [{ a: 1 }], subject: "Hi", x: null }),
    ).toEqual({ mailboxIds: { archive: true }, bcc: [{ a: 1 }], subject: "Hi", x: null });
  });

  it("patches deeper levels only where patch() is nested", () => {
    expect(
      flattenPatch({
        name: patch({ full: "Jane", parts: patch({ given: "J" }) }),
        media: patch({ avatar: { kind: "photo" } }),
      }),
    ).toEqual({
      "name/full": "Jane",
      "name/parts/given": "J",
      "media/avatar": { kind: "photo" },
    });
  });

  it("keeps JSON Pointer paths and their values as they are", () => {
    expect(flattenPatch({ "keywords/$seen": true, "media/avatar": { kind: "photo" } })).toEqual({
      "keywords/$seen": true,
      "media/avatar": { kind: "photo" },
    });
  });

  it("escapes the keys of a patch(), but not property names, which are already paths", () => {
    expect(flattenPatch({ keywords: patch({ "a~b/c": true }), "x~1y": patch({ z: 1 }) })).toEqual({
      "keywords/a~0b~1c": true,
      "x~1y/z": 1,
    });
  });

  it("sends nothing for an empty patch()", () => {
    expect(flattenPatch({ keywords: patch({}), subject: "Hi" })).toEqual({ subject: "Hi" });
  });
});

describe("patches in method calls", () => {
  const client = new JsonMetaClient({
    auth: "<opaque-token>",
    sessionUrl: "https://example.test/.well-known/jmap",
    capabilities: [mail, submission],
  });

  beforeEach(() => {
    // The calls are never sent: these tests read the arguments they would send
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(() => new Promise(() => {})),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("flattens each entry of a /set call's update", () => {
    const set = client.api.Email.set({
      update: {
        e1: { mailboxIds: patch({ inbox: null, archive: true }), keywords: patch({ $seen: true }) },
        e2: { mailboxIds: { archive: true } },
      },
    });
    expect(set.$args).toEqual({
      update: {
        e1: { "mailboxIds/inbox": null, "mailboxIds/archive": true, "keywords/$seen": true },
        e2: { mailboxIds: { archive: true } },
      },
    });
  });

  it("flattens onSuccessUpdateEmail", () => {
    const set = client.api.EmailSubmission.set({
      onSuccessUpdateEmail: { "#send": { keywords: patch({ $draft: null }) } },
    });
    expect(set.$args).toEqual({ onSuccessUpdateEmail: { "#send": { "keywords/$draft": null } } });
  });
});
