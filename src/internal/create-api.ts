import { UnknownEntityError } from "../errors/index.ts";
import type { Dispatcher } from "./dispatcher.ts";
import { MethodCall } from "./method-call.ts";
import { addRefMethod, markResultRefs } from "./ref.ts";
import type { JsonObject } from "./type-utils.ts";
import type { AugmentedOptions } from "./types.ts";

interface ApiOptions {
  dispatcher: Dispatcher;
  /**
   * Whether any capability declares the entity
   */
  isKnownEntity: (entity: string) => boolean;
  generateMethodCallId: (method: string) => string;
}

/**
 * What the proxy returns for every method: a function that makes the call
 * and returns its pending result, augmented with the call's details and
 * reference helpers. Every method of an `Augment<T>` API is assignable to it.
 */
interface ApiMethod {
  (
    args: never,
    options?: AugmentedOptions,
  ): Promise<unknown> & {
    // Typed loosely: relating each method's generic `resultRef` to a
    // signature here makes the compiler expand every pointer path
    resultRef: unknown;
    readonly $id: string;
    readonly $args: unknown;
    readonly $method: string;
  };
}

/**
 * The shape of an API the proxy can stand in for: entities whose properties
 * are methods
 */
export type ApiShape = Readonly<Record<string, Readonly<Record<string, ApiMethod>>>>;

/**
 * Create the API proxy: `api.Entity.method(args)` makes a method call for
 * any entity and method name.
 *
 * `T` names the entities and methods the caller may use, with the argument
 * and result types of each. The proxy answers every name with an
 * {@link ApiMethod}, so the cast to `T` is safe for any `T` that is an
 * {@link ApiShape}. `T` can't be constrained to it here, because the client
 * passes its API type while it is still generic; instead, type tests check
 * that the client's API, built-in or custom, is an `ApiShape`. Which names
 * exist, and their argument and result types, come from the capabilities.
 */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
export function createApi<T extends object>(options: ApiOptions): T {
  const entities = new Map<string, object>();

  return new Proxy<T>(Object.create(null), {
    get(_, entity) {
      if (!isApiProperty(entity)) {
        return undefined;
      }

      let entityProxy = entities.get(entity);
      if (!entityProxy) {
        entityProxy = createEntity(entity, options);
        entities.set(entity, entityProxy);
      }
      return entityProxy;
    },
  });
}

/**
 * Whether a proxy answers a read of the property. Promise methods are left
 * undefined so that a proxy is never mistaken for a thenable.
 */
function isApiProperty(property: string | symbol): property is string {
  return typeof property === "string" && !["then", "catch", "finally"].includes(property);
}

/**
 * Create the proxy for one entity, whose properties are its methods
 */
function createEntity(entity: string, options: ApiOptions): object {
  return new Proxy(Object.create(null), {
    get(_, method) {
      return isApiProperty(method) ? createMethod(entity, method, options) : undefined;
    },
  });
}

/**
 * Create the function that makes a method call and returns its pending
 * result, augmented with the call's details and reference helpers
 */
function createMethod(
  entity: string,
  method: string,
  { dispatcher, isKnownEntity, generateMethodCallId }: ApiOptions,
): ApiMethod {
  const name = `${entity}/${method}`;

  return (args: JsonObject, options?: AugmentedOptions) => {
    // Unknown entities keep their arguments as given and never reach
    // the dispatcher, so they get no default account and are never sent
    const known = isKnownEntity(entity);

    const methodCall = new MethodCall({
      method: name,
      args: known ? prepareArguments(args) : args,
      id: options?.id ?? generateMethodCallId(name),
    });

    const pendingResult = known
      ? dispatcher.send(methodCall)
      : Promise.reject(new UnknownEntityError({ entity, method }));

    const withRefMethod = addRefMethod(pendingResult, {
      name: methodCall.method,
      resultOf: methodCall.id,
    });

    return Object.assign(withRefMethod, {
      ...(method === "set" ? { createdRef: (id: string) => createdRef(methodCall, id) } : {}),
      $id: methodCall.id,
      $args: methodCall.args,
      $method: methodCall.method,
    });
  };
}

/**
 * Rewrite the key of each top-level result reference in a method call's
 * arguments
 */
function prepareArguments(args: JsonObject): object {
  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    throw new TypeError("JMAP method arguments must be an object");
  }
  return markResultRefs(args);
}

/**
 * Reference an object that a `/set` call creates, by its creation ID
 */
function createdRef(methodCall: MethodCall<object>, id: string): string {
  const create: unknown = Reflect.get(methodCall.args, "create");
  if (typeof create !== "object" || create === null || !Object.hasOwn(create, id)) {
    throw new RangeError(`Unknown creation ID "${id}" in ${methodCall.method}`);
  }
  return `#${id}`;
}
