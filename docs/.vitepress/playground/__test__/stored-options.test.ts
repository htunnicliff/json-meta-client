import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadOptions, optionKeys, saveOptions } from "../stored-options.ts";
import type { OptionSet } from "../stored-options.ts";

interface Choices {
  first: boolean;
  second: boolean;
}

const choices: OptionSet<Choices> = {
  defaults: { first: true, second: false },
  labels: { second: "Second", first: "First" },
  storageKey: "test:choices",
};

beforeEach(() => {
  const items = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("stored options", () => {
  it("lists the keys in label order", () => {
    expect(optionKeys(choices)).toEqual(["second", "first"]);
  });

  it("loads the defaults, then the options last saved", () => {
    expect(loadOptions(choices)).toEqual({ first: true, second: false });
    saveOptions(choices, { first: false, second: true });
    expect(loadOptions(choices)).toEqual({ first: false, second: true });
  });

  it("ignores stored keys and values that don't fit", () => {
    localStorage.setItem("test:choices", '{"first":"no","third":true,"second":true}');
    expect(loadOptions(choices)).toEqual({ first: true, second: true });
  });
});
