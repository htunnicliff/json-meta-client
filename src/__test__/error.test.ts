import { describe, expect, it } from "vitest";

import { JmapError } from "../error.js";

describe("JmapError.isProblemDetails", () => {
  it("accepts an object with a string `type`", () => {
    expect(JmapError.isProblemDetails({ type: "urn:example" })).toBe(true);
  });

  it("accepts problem details carrying extra fields", () => {
    const details = {
      type: "urn:ietf:params:jmap:error:limit",
      limit: "maxSizeRequest",
      status: 400,
    };
    expect(JmapError.isProblemDetails(details)).toBe(true);
  });

  it("rejects a missing `type`", () => {
    expect(JmapError.isProblemDetails({ detail: "nope" })).toBe(false);
  });

  it("rejects a non-string `type`", () => {
    expect(JmapError.isProblemDetails({ type: 42 })).toBe(false);
  });

  it("rejects null and non-objects", () => {
    expect(JmapError.isProblemDetails(null)).toBe(false);
    expect(JmapError.isProblemDetails(undefined)).toBe(false);
    expect(JmapError.isProblemDetails("type")).toBe(false);
    expect(JmapError.isProblemDetails(123)).toBe(false);
  });
});

describe("JmapError constructor", () => {
  it("copies problem-details fields off the cause", () => {
    const cause = {
      type: "urn:ietf:params:jmap:error:limit",
      detail: "Too many calls",
      instance: "/some/instance",
      limit: "maxCallsInRequest",
      methodCallId: "c0",
      status: 400,
    };

    const error = new JmapError("boom", cause);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("JmapError");
    expect(error.message).toBe("boom");
    expect(error.cause).toBe(cause);
    expect(error.type).toBe(cause.type);
    expect(error.detail).toBe(cause.detail);
    expect(error.instance).toBe(cause.instance);
    expect(error.limit).toBe(cause.limit);
    expect(error.methodCallId).toBe(cause.methodCallId);
    expect(error.status).toBe(cause.status);
  });

  it("leaves optional fields undefined when absent", () => {
    const error = new JmapError("minimal", { type: "urn:example" });

    expect(error.type).toBe("urn:example");
    expect(error.detail).toBeUndefined();
    expect(error.instance).toBeUndefined();
    expect(error.limit).toBeUndefined();
    expect(error.methodCallId).toBeUndefined();
    expect(error.status).toBeUndefined();
  });

  it("throws when the cause is not problem details", () => {
    expect(() => new JmapError("bad", { nope: true })).toThrow("Invalid JMAP error cause");
    expect(() => new JmapError("bad", null)).toThrow("Invalid JMAP error cause");
  });
});
