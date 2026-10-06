import { describe, expect, it } from "vitest";

import * as builtInCapabilities from "../capabilities/index.ts";
import {
  CapabilityConfigurationError,
  ConfigurationError,
  HttpError,
  InvalidUriTemplateError,
  isCapabilityConfigurationError,
  isConfigurationError,
  isHttpError,
  isInvalidUriTemplateError,
  isJmapError,
  isJsonMetaError,
  isMethodCallError,
  isNetworkError,
  isStateChangeError,
  isUnknownError,
  JmapError,
  JsonMetaError,
  MethodCallError,
  NetworkError,
  StateChangeError,
  UnknownError,
} from "../index.ts";
import { MethodCall } from "../internal/method-calls.ts";

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
    for (const cause of [{ nope: true }, null, "server failed"]) {
      expect(() => new JmapError("bad", cause)).toThrow(UnknownError);
      expect(() => new JmapError("bad", cause)).toThrow(
        expect.objectContaining({ message: "bad", cause }),
      );
    }
  });
});

describe("error classification", () => {
  const methodCall = new MethodCall({ method: "Mailbox/query", args: { limit: 1 } });
  const errors = [
    [new JsonMetaError("base"), isJsonMetaError],
    [new ConfigurationError("configuration"), isConfigurationError],
    [
      new CapabilityConfigurationError("capability", { capability: "unknown" }),
      isCapabilityConfigurationError,
    ],
    [
      new InvalidUriTemplateError("template", { template: "/{id}", params: {} }),
      isInvalidUriTemplateError,
    ],
    [new NetworkError("network", { cause: null, request: undefined }), isNetworkError],
    [
      new HttpError("http", {
        request: new Request("https://example.test"),
        response: new Response(null, { status: 503 }),
      }),
      isHttpError,
    ],
    [new MethodCallError("method", { methodCall }), isMethodCallError],
    [new JmapError("jmap", { type: "serverFail" }), isJmapError],
    [new UnknownError("unknown"), isUnknownError],
    [new StateChangeError("state", { cause: null }), isStateChangeError],
  ] as const;

  it.each(errors)("recognizes %s as a library error", (error, guard) => {
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(JsonMetaError);
    expect(error.name).toBe(error.constructor.name);
    expect(isJsonMetaError(error)).toBe(true);
    expect(guard(error)).toBe(true);
  });

  it.each(errors)("rejects unrelated values in the guard for %s", (error, guard) => {
    const unrelatedValues = [
      null,
      undefined,
      "error",
      {},
      new Error("ordinary"),
      { name: error.name },
    ];
    for (const input of unrelatedValues) {
      expect(guard(input)).toBe(false);
    }
    for (const [other] of errors) {
      expect(guard(other)).toBe(other instanceof error.constructor);
    }
  });

  it("classifies capability errors as configuration errors", () => {
    const error = new CapabilityConfigurationError("invalid", { capability: "unknown" });
    expect(isConfigurationError(error)).toBe(true);
    expect(error.givenCapability).toBe("unknown");
    expect(error.availableBuiltIns).toEqual(Object.keys(builtInCapabilities));
  });

  it("preserves the request and original network failure", () => {
    const cause = new TypeError("fetch failed");
    const request = new Request("https://example.test");
    const error = new NetworkError("network", { cause, request });
    expect(error.cause).toBe(cause);
    expect(error.request).toBe(request);
  });

  it("retains method call and response data for inspection", () => {
    const responseData = { unexpected: true };
    const error = new MethodCallError("method", { methodCall, responseData });
    expect(error.methodCall).toBe(methodCall);
    expect(error.responseData).toBe(responseData);
    expect(new MethodCallError("missing", { methodCall }).responseData).toBeUndefined();
  });

  it("preserves the original method call on JMAP errors", () => {
    const cause = { type: "invalidArguments", description: "Invalid filter", extra: 42 };
    const error = new JmapError("method failed", cause, { methodCall });
    expect(error.methodCall).toBe(methodCall);
    expect(error.cause).toBe(cause);
    expect(isHttpError(error)).toBe(false);
  });

  it("preserves state-change failure causes", () => {
    const cause = new SyntaxError("Invalid JSON");
    expect(new StateChangeError("Invalid JSON", { cause }).cause).toBe(cause);
  });
});
