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
export type CapabilityMethods<Entity extends string> = Record<
  Entity,
  Record<string, (...args: any[]) => any>
>;

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
