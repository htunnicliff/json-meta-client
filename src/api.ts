// oxlint-disable typescript/no-unnecessary-type-parameters
import type { JsonObject, JsonValue } from "type-fest";

import { Batch, type Flush } from "./internal/batch.ts";
import { MethodCall, type MethodCallOptions } from "./internal/method-calls.ts";
import type { Middleware } from "./internal/types.ts";

export function createApi<T extends object>(
  processMethodCalls: Flush<MethodCall<unknown>>,
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

  const batch = new Batch(processMethodCalls);

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

              return (args: JsonObject, options: MethodCallOptions = {}) =>
                batch.enqueue(
                  new MethodCall({
                    method: `${entity}/${method}`,
                    args: options.signal?.aborted ? args : applyMiddleware(args),
                  }),
                  options.signal,
                );
            },
          }),
        );
      }

      return entityProxies.get(entity)!;
    },
  });
}
