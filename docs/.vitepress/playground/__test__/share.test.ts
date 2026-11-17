import { describe, expect, it } from "vitest";

import { decodeShare, encodeShare, MAX_HASH_LENGTH } from "../share.ts";

describe(encodeShare, () => {
  it("round-trips code through a versioned, URL-safe hash", async () => {
    const code = 'const emails = await client.api.Email.get({ ids: ["ü", "😀"] });\n'.repeat(20);

    const hash = await encodeShare(code);

    expect(hash).toMatch(/^code\/1\/[\w-]+$/);
    expect(hash.length).toBeLessThan(code.length);
    expect(await decodeShare(`#${hash}`)).toEqual({ kind: "code", code });
  });
});

describe(decodeShare, () => {
  it("ignores hashes that hold no code", async () => {
    expect(await decodeShare("")).toEqual({ kind: "none" });
    expect(await decodeShare("#features")).toEqual({ kind: "none" });
  });

  it("rejects malformed, unknown and oversized hashes without throwing", async () => {
    expect(await decodeShare("#code/1/!!!")).toEqual({ kind: "invalid", reason: "malformed" });
    expect(await decodeShare("#code/1/AAAA")).toEqual({ kind: "invalid", reason: "malformed" });
    expect(await decodeShare("#code/9/AAAA")).toEqual({
      kind: "invalid",
      reason: "unsupported version",
    });
    expect(await decodeShare(`#code/1/${"A".repeat(MAX_HASH_LENGTH)}`)).toEqual({
      kind: "invalid",
      reason: "too long",
    });
  });

  it("rejects a hash that expands into too much code", async () => {
    const hash = await encodeShare(" ".repeat(1_000_000));

    expect(hash.length).toBeLessThan(MAX_HASH_LENGTH);
    expect(await decodeShare(hash)).toEqual({ kind: "invalid", reason: "too large" });
  });
});
