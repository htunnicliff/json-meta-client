import type { CapabilityMethods, ConfigurableCapability } from "./internal/types.ts";

export interface MethodContract {
  input: unknown;
  output: unknown;
}

/**
 * A fully configured capability:
 * - Known entities (type and value)
 * - Known urn (value)
 * - Known methods (type)
 */
export interface Capability<
  Entity extends string = string,
  _Methods extends CapabilityMethods<Entity> = CapabilityMethods<Entity>,
  Urn extends string = string,
> {
  urn: Urn;
  entities: ReadonlyArray<Entity>;
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
export function defineCapability<const Entity extends string, const Urn extends string = string>({
  urn,
  entities,
}: {
  urn: Urn;
  entities: ReadonlyArray<Entity>;
}): ConfigurableCapability<Entity, Urn> {
  return {
    urn,
    entities,
    withMethods: () => ({ urn, entities }),
  };
}
