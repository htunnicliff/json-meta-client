import type { ExtendedJSONPointer, ResultReference } from "jmap-rfc-types";
import type { JsonValue } from "type-fest";

import type { MethodCall } from "./method-calls.ts";

const refSymbol = Symbol("ref");

export function ref<T>(methodCall: MethodCall<T>, pointer: ExtendedJSONPointer) {
  return {
    name: methodCall.method,
    resultOf: methodCall.id,
    path: pointer,
    [refSymbol]: true,
  };
}

export function isRef(input: unknown): input is ResultReference {
  return typeof input === "object" && input !== null && Object.hasOwn(input, refSymbol);
}

/**
 * Recursively detect any objects containing result references,
 * updating their keys to use a `#` prefix
 */
export function replaceNestedResultRefKeys(input: JsonValue): JsonValue {
  if (Array.isArray(input)) {
    return input.map((item) => replaceNestedResultRefKeys(item));
  }

  if (typeof input === "object" && input !== null) {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => {
        if (isRef(value)) {
          return [`#${key}`, value];
        }

        return [key, replaceNestedResultRefKeys(value)];
      }),
    );
  }

  return input;
}
