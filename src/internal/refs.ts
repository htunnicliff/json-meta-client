import type { JsonValue } from "type-fest";

import { isRef } from "../ref.ts";

/**
 * Recursively detect any objects containing result references,
 * updating their keys to use a # prefix
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
