import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { codeOptions } from "../code-options.ts";
import { loadCode, saveCode } from "../code-storage.ts";
import { defaultExample, examples } from "../examples.ts";
import { loadOptions, saveOptions } from "../stored-options.ts";

const first = defaultExample;
const items = new Map<string, string>();

beforeEach(() => {
  items.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("stored code", () => {
  it("starts with the first example", () => {
    expect(loadCode()).toBe(first);
  });

  it("loads the user's own code as saved", () => {
    saveCode("console.log(1);\n");
    expect(loadCode()).toBe("console.log(1);\n");
  });

  it("keeps an example by its ID", () => {
    const example = examples.at(-1)!;
    saveCode(`  ${example.code}  `);
    expect([...items.values()]).toEqual([JSON.stringify({ example: example.id })]);
    expect(loadCode()).toBe(example.code);
  });

  it("keeps the code apart from the editor's options", () => {
    saveCode("console.log(1);\n");
    saveOptions(codeOptions, { ...codeOptions.defaults, wrapLines: true });
    expect(loadCode()).toBe("console.log(1);\n");
    expect(loadOptions(codeOptions).wrapLines).toBe(true);
  });

  it("falls back to the first example when storage holds something else", () => {
    items.set("json-meta-client:playground:source", '{"example":"gone"}');
    expect(loadCode()).toBe(first);
    items.set("json-meta-client:playground:source", "not json");
    expect(loadCode()).toBe(first);
  });

  it("lasts the visit when storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    expect(() => saveCode("x")).not.toThrow();
    expect(loadCode()).toBe(first);
  });
});
