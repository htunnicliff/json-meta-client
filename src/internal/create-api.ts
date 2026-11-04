/**
 * Copyright (c) 2026 Hunter Tunnicliff
 *
 * This source code is subject to the terms of the Mozilla Public
 * License, version 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { JsonObject, JsonValue } from "type-fest";

import type { Flush } from "./batch.ts";
import { Batch } from "./batch.ts";
import { MethodCall } from "./method-call.ts";
import { addRefMethod } from "./ref.ts";
import type { AugmentedOptions, Middleware } from "./types.ts";

interface ApiOptions {
  processMethodCalls: Flush<MethodCall<unknown>>;
  middleware: ReadonlyArray<Middleware>;
  signal?: AbortSignal;
}

export function createApi<T extends object>({
  processMethodCalls,
  middleware,
  signal,
}: ApiOptions): T {
  const entityProxies = new Map<string, object>();

  const applyMiddleware = (payload: JsonObject): JsonValue => {
    let transformed: JsonValue = payload;
    for (const fn of middleware) {
      transformed = fn(transformed);
    }
    return transformed;
  };

  const batch = new Batch(processMethodCalls, { signal });

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

              const fn = (args: JsonObject, options?: AugmentedOptions) => {
                const methodCall = new MethodCall({
                  method: `${entity}/${method}`,
                  args: applyMiddleware(args),
                  id: options?.id,
                });

                const pendingResult = batch.enqueue(methodCall);

                const withRefMethod = addRefMethod(pendingResult, {
                  name: methodCall.method,
                  resultOf: methodCall.id,
                });

                const createdRef = (id: string): string => {
                  const args = methodCall.args;
                  const create =
                    typeof args === "object" && args !== null
                      ? Reflect.get(args, "create")
                      : undefined;
                  if (typeof create !== "object" || create === null || !Object.hasOwn(create, id)) {
                    throw new RangeError(`Unknown creation ID "${id}" in ${methodCall.method}`);
                  }
                  return `#${id}`;
                };

                const withMethodCall = Object.assign(withRefMethod, {
                  ...(method === "set" ? { createdRef } : {}),
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
