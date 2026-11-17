import { describe, expect, it } from "vitest";

import { formatTypeScript, minimalChange } from "../prettier.ts";

describe(formatTypeScript, () => {
  it("formats TypeScript and keeps the cursor on the same code", async () => {
    const code = "const a = {b:1,c:'x'}\n";
    const result = await formatTypeScript(code, code.indexOf("c:"));

    expect(result.code).toBe('const a = { b: 1, c: "x" };\n');
    expect(result.code.slice(result.cursorOffset)).toMatch(/^c: "x"/);
  });

  it("rejects code that doesn't parse", async () => {
    await expect(formatTypeScript("const = ;", 0)).rejects.toThrow("Variable declaration expected");
  });
});

describe(minimalChange, () => {
  it("replaces only the text that differs", () => {
    expect(minimalChange("const a=1;\nfoo()", "const a = 1;\nfoo()")).toEqual({
      from: 7,
      to: 8,
      insert: " = ",
    });
  });

  it("is undefined for equal text", () => {
    expect(minimalChange("same", "same")).toBeUndefined();
  });

  it("handles text that only grows or shrinks at an end", () => {
    expect(minimalChange("ab", "abc")).toEqual({ from: 2, to: 2, insert: "c" });
    expect(minimalChange("abc", "bc")).toEqual({ from: 0, to: 1, insert: "" });
  });
});
