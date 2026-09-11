import nock, { Scope } from "nock";
import { beforeEach, describe, expect, it } from "vitest";

import { Client, Config } from "../client.ts";

const DEFAULT_SESSION_URL = "https://example.test";
const DEFAULT_API_URL = `${DEFAULT_SESSION_URL}/special-jmap-api`;

const DEFAULT_OPTIONS = {
  bearerToken: "<tok>",
  sessionUrl: DEFAULT_SESSION_URL,
} satisfies Config;

describe("Client", () => {
  let scope: Scope;

  beforeEach(() => {
    scope = nock(/example\.test/)
      .get("/")
      .reply(200, { apiUrl: DEFAULT_API_URL });
  });

  it("has expected public properties", async () => {
    const client = new Client(DEFAULT_OPTIONS);
    expect(client).toHaveProperty("api");
    expect(client).toHaveProperty("session");
    expect(client).toHaveProperty("refreshSession");
    const session = await client.session;
    expect(session.apiUrl).toBe(DEFAULT_API_URL);
    expect(scope.isDone()).toBe(true);
  });

  it("is frozen", () => {
    const client = new Client(DEFAULT_OPTIONS);
    expect(Object.isFrozen(client)).toBe(true);
  });

  it("throws invalid session URLs", () => {
    expect(() => new Client({ ...DEFAULT_OPTIONS, sessionUrl: "invalid-url" })).toThrow(
      new Error("Invalid session URL", { cause: "invalid-url" }),
    );
    expect(scope.isDone()).toBe(false);
  });

  it("accepts valid URL instance session URLs", () => {
    expect(
      () =>
        new Client({
          ...DEFAULT_OPTIONS,
          sessionUrl: new URL(DEFAULT_SESSION_URL),
        }),
    ).not.toThrow();
  });

  describe("session", () => {
    it("is a pending promise", async () => {
      const client = new Client(DEFAULT_OPTIONS);
      expect(client.session).toBeInstanceOf(Promise);
      await expect(client.session).resolves.not.toThrow();
    });
  });
});
