import { describe, expect, it, vi } from "vitest";

import { addDisposeFallback, disposeKey, disposeKeyFor } from "../disposable.ts";

describe(disposeKey, () => {
  it("is Symbol.dispose where the runtime has it, and disconnect otherwise", () => {
    expect(disposeKey()).toBe(Symbol.dispose);
    expect(disposeKeyFor(Symbol.dispose)).toBe(Symbol.dispose);
    expect(disposeKeyFor(undefined)).toBe("disconnect");
  });
});

describe(addDisposeFallback, () => {
  it("adds a disconnect method on a runtime without Symbol.dispose", () => {
    const target = {};
    const dispose = vi.fn<() => void>();

    addDisposeFallback(target, dispose, disposeKeyFor(undefined));

    expect(target).toHaveProperty("disconnect", dispose);
  });

  it("adds nothing where Symbol.dispose exists", () => {
    const target = {};

    addDisposeFallback(target, () => {});

    expect(Object.getOwnPropertyNames(target)).toEqual([]);
  });
});
