import { describe, expect, it } from "vitest";

import { createApi } from "../internal/create-api.ts";

describe("set creation references", () => {
  function makeApi() {
    return createApi<{
      Email: {
        set: (args: { create: Record<string, { subject: string }> }) =>
          Promise<unknown> & { created: (id: string) => string };
      };
    }>({
      middleware: [],
      processMethodCalls: (jobs) => {
        for (const job of jobs) {
          job.handle.resolve({});
        }
      },
    });
  }

  it("returns a prefixed reference for a creation ID in the set call", async () => {
    const api = makeApi();
    const draft = api.Email.set({ create: { draft: { subject: "Hello" } } });

    expect(draft.created("draft")).toBe("#draft");
    await expect(draft).resolves.toEqual({});
  });

  it("rejects a creation ID not present in that call", async () => {
    const api = makeApi();
    const draft = api.Email.set({ create: { draft: { subject: "Hello" } } });

    expect(() => draft.created("other")).toThrow(RangeError);
    expect(() => draft.created("other")).toThrow('Unknown creation ID "other" in Email/set');
    await draft;
  });

  it("does not expose the helper on non-set methods", async () => {
    const api = createApi<{
      Email: { get: (args: Record<string, never>) => Promise<unknown> };
    }>({
      middleware: [],
      processMethodCalls: (jobs) => {
        for (const job of jobs) job.handle.resolve({});
      },
    });
    const query = api.Email.get({});
    expect(query).not.toHaveProperty("created");
    await query;
  });
});
