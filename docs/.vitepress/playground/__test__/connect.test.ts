import { describe, expect, it, vi } from "vitest";

import { authorization, checkConnection } from "../connect.ts";

const sessionUrl = "https://jmap.example.com/.well-known/jmap";

const status = (code: number) => async () => new Response("no", { status: code });

describe(authorization, () => {
  it("sends a token as a bearer token, and a username and password as Basic", () => {
    expect(authorization("abc")).toBe("Bearer abc");
    expect(authorization({ username: "ü@example.com", password: "p" })).toBe(
      `Basic ${Buffer.from("ü@example.com:p").toString("base64")}`,
    );
  });
});

describe(checkConnection, () => {
  it("accepts a server that answers with a Session", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({ apiUrl: "https://jmap.example.com/api", username: "me" }),
    );

    expect(await checkConnection({ sessionUrl, auth: "abc" }, fetch)).toEqual({
      ok: true,
      username: "me",
    });
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get("authorization")).toBe("Bearer abc");
  });

  it("tells a server without CORS from one that can't be reached", async () => {
    const blocked = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
      if (init?.mode === "no-cors") {
        return new Response(null);
      }
      throw new TypeError("Failed to fetch");
    });
    const down = vi.fn<typeof globalThis.fetch>(async () => {
      throw new TypeError("Failed to fetch");
    });

    expect(await checkConnection({ sessionUrl, auth: "abc" }, blocked)).toEqual({
      ok: false,
      message: expect.stringContaining("doesn't allow this site through CORS"),
    });
    expect(await checkConnection({ sessionUrl, auth: "abc" }, down)).toEqual({
      ok: false,
      message: expect.stringContaining("Couldn't reach jmap.example.com"),
    });
  });

  it("explains rejected credentials and answers that aren't a Session", async () => {
    expect(await checkConnection({ sessionUrl, auth: "abc" }, status(401))).toEqual({
      ok: false,
      message: "jmap.example.com rejected the credentials (HTTP 401).",
    });
    expect(await checkConnection({ sessionUrl, auth: "abc" }, status(500))).toEqual({
      ok: false,
      message: "jmap.example.com answered with HTTP 500.",
    });
    expect(await checkConnection({ sessionUrl, auth: "abc" }, status(200))).toEqual({
      ok: false,
      message: "jmap.example.com didn't answer with a JMAP Session.",
    });
    expect(await checkConnection({ sessionUrl: "nope", auth: "abc" })).toEqual({
      ok: false,
      message: "The Session URL is not a valid URL.",
    });
  });
});
