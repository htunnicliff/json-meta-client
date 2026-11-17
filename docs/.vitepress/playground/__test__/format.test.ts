import { describe, expect, it } from "vitest";

import { formatConsoleArgs, formatValue } from "../format.ts";

function named() {}

describe(formatValue, () => {
  it("writes values as JavaScript-like literals", () => {
    expect(formatValue({ a: 1, "b-c": "x", d: [true, null, undefined], e: 2n })).toBe(
      '{ a: 1, "b-c": "x", d: [true, null, undefined], e: 2n }',
    );
  });

  it("wraps long values onto several lines", () => {
    const list = Array.from({ length: 3 }, (_, index) => ({
      subject: `Message ${index}`,
      from: "a@example.com",
    }));
    expect(formatValue({ list })).toBe(`{
  list: [
    { subject: "Message 0", from: "a@example.com" },
    { subject: "Message 1", from: "a@example.com" },
    { subject: "Message 2", from: "a@example.com" },
  ],
}`);
  });

  it("names classes, and marks circular and deep values", () => {
    class Thing {
      self: unknown = this;
    }
    expect(formatValue(new Thing())).toBe("Thing { self: [Circular] }");
    expect(formatValue({ a: { b: { c: { d: { e: 1 } } } } })).toBe(
      "{ a: { b: { c: { d: [Object] } } } }",
    );
  });

  it("writes errors, functions, maps and sets", () => {
    expect(formatValue([new TypeError("nope"), named, new Set([1])])).toBe(
      "[TypeError: nope, [Function named], Set(1) { 1 }]",
    );
  });
});

describe(formatConsoleArgs, () => {
  it("leaves string arguments as they are", () => {
    expect(formatConsoleArgs(["Subject:", "Hi", 3])).toBe("Subject: Hi 3");
  });
});
