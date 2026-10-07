// oxlint-disable typescript/no-unnecessary-type-parameters
import type { JsonObject, JsonValue } from "type-fest";

import type { Flush } from "./batch.ts";
import { Batch } from "./batch.ts";
import { MethodCall } from "./method-call.ts";
import { addRefMethod } from "./ref.ts";
import type { Middleware } from "./types.ts";

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

  // TODO: Enforce strict linkage between this proxy type and Augment<T>
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

              const fn = (args: JsonObject) => {
                const methodCall = new MethodCall({
                  method: `${entity}/${method}`,
                  args: applyMiddleware(args),
                });

                const pendingResult = batch.enqueue(methodCall);

                const withRefMethod = addRefMethod(pendingResult, {
                  name: methodCall.method,
                  resultOf: methodCall.id,
                });

                const withMethodCall = Object.assign(withRefMethod, {
                  $id: methodCall.id,
                  $args: methodCall.args,
                  $method: methodCall.method,
                });

                return withMethodCall;
              };

              return fn;
            },
          }),
        );
      }

      return entityProxies.get(entity)!;
    },
  });
}
