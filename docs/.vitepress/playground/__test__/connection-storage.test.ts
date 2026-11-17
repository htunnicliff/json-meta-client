import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { forgetConnection, loadConnection, saveConnection } from "../connection-storage.ts";

function memoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("connection storage", () => {
  it("remembers a connection until it is forgotten", () => {
    const connection = {
      sessionUrl: "https://mail.example.org/.well-known/jmap",
      auth: { username: "me", password: "secret" },
    };

    expect(loadConnection()).toBeUndefined();
    saveConnection(connection);
    expect(loadConnection()).toEqual(connection);
    forgetConnection();
    expect(loadConnection()).toBeUndefined();
  });

  it("ignores stored values that aren't a connection", () => {
    localStorage.setItem("json-meta-client:playground:connection", '{"sessionUrl":1}');
    expect(loadConnection()).toBeUndefined();
    localStorage.setItem("json-meta-client:playground:connection", "not json");
    expect(loadConnection()).toBeUndefined();
  });

  it("does without storage when it is unavailable", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(() => saveConnection({ sessionUrl: "https://a.example", auth: "t" })).not.toThrow();
    expect(loadConnection()).toBeUndefined();
  });
});
