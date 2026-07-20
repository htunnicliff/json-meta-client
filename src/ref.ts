import type { ResultReference } from "jmap-rfc-types";
import type { JsonValue, Paths, Replace } from "type-fest";

import type { BatchResult } from "./batcher.ts";
import type { MethodCall } from "./method-calls.ts";

const refSymbol = Symbol("ref");

type ReplaceArrayKeyWithAsterisk<T> = {
  [K in keyof T]: T[K] extends ArrayLike<infer I extends object>
    ? { "*": ReplaceArrayKeyWithAsterisk<I> }
    : ReplaceArrayKeyWithAsterisk<T[K]>;
};

type ReplaceDotsWithSlashes<T> = Replace<
  // @ts-expect-error
  Paths<ReplaceArrayKeyWithAsterisk<T>>,
  ".",
  "/",
  { all: true }
>;

export function ref<Output, Pointer extends ReplaceDotsWithSlashes<Output>>(
  methodCall: BatchResult<MethodCall<unknown>, Output>,
  pointer: `/${Pointer}`,
) {
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
