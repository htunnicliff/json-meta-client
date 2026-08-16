import type { BatchResult } from "./batcher.ts";
import type { MethodCall } from "./method-calls.ts";
import type { UnpackRefs } from "./ref.ts";
import type { AllowRefsInArgs, OptionalAccountId } from "./types.ts";

/**
 * The primary type used to define JMAP calls for
 * one or more entities.
 *
 * @example
 * ```ts
 * type Methods = {
 *   Email: {
 *       get: <A>(args: A) => SomeResult<A>;
 *       query: <A>(args: A) => SomeOtherResult<A>;
 *   };
 *   Thread: {};
 *   Mailbox: {};
 *   SearchSnippet: {};
 * };
 * ```
 */
export type CapabilityMethods<Entity extends string> = {
  [key in Entity]: {
    [method: string]: (arg: any) => any;
  };
};

export type Augment<T extends CapabilityMethods<string>> = {
  [Entity in keyof T]: {
    [Method in keyof T[Entity]]: T[Entity][Method] extends (
      arg: infer OriginalArgs,
    ) => infer OriginalReturn
      ? <WrappedArgs extends OptionalAccountId<AllowRefsInArgs<OriginalArgs>>>(
          arg: WrappedArgs,
        ) => BatchResult<MethodCall<UnpackRefs<WrappedArgs>>, OriginalReturn>
      : never;
  };
};

/**
 * A partially-configured capability that supports using
 * layers of generics. The first layer captures the {@link Entity}
 * type, while the second layer captures the {@link CapabilityMethods}
 */
export interface ConfigurableCapability<Entity extends string> {
  urn: string;
  entities: Entity[];
  withMethods<M extends CapabilityMethods<Entity>>(): Capability<Entity, M>;
}

/**
 * A fully configured capability:
 * - Known entities (type and value)
 * - Known urn (value)
 * - Known methods (type)
 */
export interface Capability<Entity extends string, _Methods extends CapabilityMethods<Entity>> {
  urn: string;
  entities: Entity[];
}

/**
 * Extracts the {@link CapabilityMethods} from a configured
 * {@link Capability}
 */
export type InferMethodsFromCapability<C> =
  C extends Capability<infer _Entity, infer Methods> ? Methods : never;

/**
 * Define a JMAP capability for one or more entities
 *
 * @example
 * ```ts
 * const Core = defineCapability({ })
 * ```
 */
export function defineCapability<const Entity extends string>({
  urn,
  entities,
}: {
  urn: string;
  entities: Entity[];
}): ConfigurableCapability<Entity> {
  return {
    urn,
    entities,
    withMethods: () => ({ urn, entities }),
  };
}
