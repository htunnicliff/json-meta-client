import { JmapConfigurationError } from "../../error.ts";
import { isRef } from "../../ref.ts";
import type { Middleware } from "../types.ts";

/**
 * Recursively detect any objects containing result references,
 * updating their keys to use a # prefix
 */
export const replaceNestedResultRefKeys: Middleware = (payload) => {
  const active = new WeakSet<object>();
  const visit: Middleware = (value) => {
    if (typeof value !== "object" || value === null) return value;
    if (active.has(value))
      throw new JmapConfigurationError("Method arguments must not contain cycles");
    active.add(value);
    try {
      if (Array.isArray(value)) return value.map((item) => visit(item));
      return Object.fromEntries(
        Object.entries(value).map(([key, nested]) =>
          isRef(nested) ? [`#${key}`, nested] : [key, visit(nested)],
        ),
      );
    } finally {
      active.delete(value);
    }
  };
  return visit(payload);
};
