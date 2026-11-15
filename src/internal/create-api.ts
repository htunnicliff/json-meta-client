// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

// oxlint-disable typescript/no-unnecessary-type-parameters

import type { JsonObject, JsonValue } from "type-fest";

import { UnknownEntityError } from "../errors.ts";
import type { Dispatcher } from "./dispatcher.ts";
import { MethodCall } from "./method-call.ts";
import { addRefMethod } from "./ref.ts";
import type { AugmentedOptions, Middleware } from "./types.ts";

interface ApiOptions {
  dispatcher: Dispatcher;
  middleware: ReadonlyArray<Middleware>;
  /**
   * Whether any capability declares the entity
   */
  isKnownEntity: (entity: string) => boolean;
}

export function createApi<T extends object>({
  dispatcher,
  middleware,
  isKnownEntity,
}: ApiOptions): T {
  const entityProxies = new Map<string, object>();

  const applyMiddleware = (payload: JsonObject, name: string): object => {
    let transformed: JsonValue = payload;
    for (const fn of middleware) {
      transformed = fn(transformed, { name });
    }
    if (typeof transformed !== "object" || transformed === null || Array.isArray(transformed)) {
      throw new TypeError("JMAP method arguments must be an object");
    }
    return transformed;
  };

  // TODO: Enforce strict linkage between this proxy type and Augment<T>
  return new Proxy<T>(Object.create(null), {
    get(_, entity) {
      if (typeof entity !== "string" || ["then", "catch", "finally"].includes(entity)) {
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
                const known = isKnownEntity(entity);

                // Unknown entities skip middleware (no account ID injection)
                // and never reach the dispatcher, so they are never sent
                const name = `${entity}/${method}`;
                const methodCall = new MethodCall({
                  method: name,
                  args: known ? applyMiddleware(args, name) : args,
                  id: options?.id,
                });

                const pendingResult = known
                  ? dispatcher.send(methodCall)
                  : Promise.reject(new UnknownEntityError({ entity, method }));

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
