import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mail } from "../capabilities/mail.ts";
import { submission } from "../capabilities/submission.ts";
import { JsonMetaClient } from "../client.ts";
import { flattenPatch, patchMap, replace } from "../patch.ts";
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
  it("patches a plain object key by key", () => {
    expect(
      flattenPatch({
        mailboxIds: { inbox: null, archive: true },
        keywords: { $seen: true },
      }),
    ).toEqual({ "mailboxIds/inbox": null, "mailboxIds/archive": true, "keywords/$seen": true });
  });

  it("descends to the first value that isn't a plain object", () => {
    expect(
      flattenPatch({ name: { full: "Jane" }, addressBookIds: { a: { b: true } }, bcc: [{ a: 1 }] }),
    ).toEqual({ "name/full": "Jane", "addressBookIds/a/b": true, bcc: [{ a: 1 }] });
  });

  it("sends a replaced value whole", () => {
    expect(
      flattenPatch({
        mailboxIds: replace({ archive: true }),
        media: { avatar: replace({ kind: "photo" }) },
      }),
    ).toEqual({ mailboxIds: { archive: true }, "media/avatar": { kind: "photo" } });
  });

  it("keeps JSON Pointer paths and their values as they are", () => {
    expect(flattenPatch({ "keywords/$seen": true, "media/avatar": { kind: "photo" } })).toEqual({
      "keywords/$seen": true,
      "media/avatar": { kind: "photo" },
    });
  });

  it("escapes nested keys, but not property names, which are already paths", () => {
    expect(flattenPatch({ keywords: { "a~b/c": true }, "x~1y": { z: 1 } })).toEqual({
      "keywords/a~0b~1c": true,
      "x~1y/z": 1,
    });
  });

  it("sends nothing for an empty nested object", () => {
    expect(flattenPatch({ keywords: {}, subject: "Hi" })).toEqual({ subject: "Hi" });
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
      update: { e1: { mailboxIds: { inbox: null, archive: true }, keywords: { $seen: true } } },
    });
    expect(set.$args).toEqual({
      update: {
        e1: { "mailboxIds/inbox": null, "mailboxIds/archive": true, "keywords/$seen": true },
      },
    });
  });

  it("flattens onSuccessUpdateEmail", () => {
    const set = client.api.EmailSubmission.set({
      onSuccessUpdateEmail: { "#send": { keywords: { $draft: null } } },
    });
    expect(set.$args).toEqual({ onSuccessUpdateEmail: { "#send": { "keywords/$draft": null } } });
  });

  it("leaves create alone", () => {
    const set = client.api.Email.set({ create: { d: { mailboxIds: { inbox: true } } } });
    expect(set.$args).toEqual({ create: { d: { mailboxIds: { inbox: true } } } });
  });
});
