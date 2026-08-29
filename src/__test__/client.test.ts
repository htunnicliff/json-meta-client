import { describe, expect, it } from "vitest";

import { Client, Config } from "../client.ts";

const DEFAULT_OPTIONS = {
  bearerToken: "<tok>",
  sessionUrl: "https://example.test",
} satisfies Config;

describe("Client", () => {
  it("has expected public properties", () => {
    const client = new Client(DEFAULT_OPTIONS);
    expect(client).toHaveProperty("api");
    expect(client).toHaveProperty("session");
    expect(client).toHaveProperty("refreshSession");
  });

  it("is frozen", () => {
    const client = new Client(DEFAULT_OPTIONS);
    expect(Object.isFrozen(client)).toBe(true);
  });

  it("throws invalid session URLs", () => {
    expect(() => new Client({ ...DEFAULT_OPTIONS, sessionUrl: "invalid-url" })).toThrow(
      new Error("Invalid session URL", { cause: "invalid-url" }),
    );
  });

  it("accepts valid string session URLs", () => {
    expect(
      () => new Client({ ...DEFAULT_OPTIONS, sessionUrl: "https://valid.example" }),
    ).not.toThrow();
  });

  it("accepts valid URL instance session URLs", () => {
    expect(
      () => new Client({ ...DEFAULT_OPTIONS, sessionUrl: new URL("https://valid.example") }),
    ).not.toThrow();
  });

  describe("session", () => {
    it("is a pending promise", async () => {
      const client = new Client(DEFAULT_OPTIONS);
      expect(client.session).toBeInstanceOf(Promise);
    });
  });
});
