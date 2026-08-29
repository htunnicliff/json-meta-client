// oxlint-disable typescript/no-unnecessary-type-parameters
import type { JsonObject, JsonValue } from "type-fest";

import { MethodCall } from "./internal/method-calls.ts";
import type { Middleware } from "./internal/types.ts";

export function createApi<T extends object>(
  enqueue: (methodCall: MethodCall<unknown>) => unknown,
  middleware: ReadonlyArray<Middleware>,
): T {
  const entityProxies = new Map<string, object>();

  const applyMiddleware = (payload: JsonObject): JsonValue => {
    let transformed: JsonValue = payload;
    for (const fn of middleware) {
      transformed = fn(transformed);
    }
    return transformed;
  };

  return new Proxy<T>(Object.create(null), {
    get(_, entity) {
      if (typeof entity !== "string") {
        return undefined;
      }

      if (!entityProxies.has(entity)) {
        entityProxies.set(
          entity,
          new Proxy(Object.create(null), {
            get(__, method) {
              if (typeof method !== "string" || ["then", "catch", "finally"].includes(method)) {
                return undefined;
              }

              return (args: JsonObject) =>
                enqueue(
                  new MethodCall({
                    method: `${entity}/${method}`,
                    args: applyMiddleware(args),
                  }),
                );
            },
          }),
        );
      }

      return entityProxies.get(entity)!;
    },
  });
}
