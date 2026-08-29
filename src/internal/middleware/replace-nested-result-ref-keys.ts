import { isRef } from "../../ref.ts";
import type { Middleware } from "../types.ts";

/**
 * Recursively detect any objects containing result references,
 * updating their keys to use a # prefix
 */
export const replaceNestedResultRefKeys: Middleware = (payload) => {
  if (Array.isArray(payload)) {
    return payload.map((item) => replaceNestedResultRefKeys(item));
  }

  if (typeof payload === "object" && payload !== null) {
    return Object.fromEntries(
      Object.entries(payload).map(([key, value]) => {
        if (isRef(value)) {
          return [`#${key}`, value];
        }

        return [key, replaceNestedResultRefKeys(value)];
      }),
    );
  }

  return payload;
};
