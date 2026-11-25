import { describe, expect, it } from "vitest";

import { patchMap } from "../patch.ts";
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
