import type { SetOptional, SetRequired, Simplify } from "type-fest";

import type { JobResult } from "./internal/batch.ts";
import type { MethodCall } from "./internal/method-calls.ts";
import type { AllowRefs, UnpackRefs } from "./ref.ts";

export interface MethodContract {
  input: unknown;
  output: unknown;
}

export type Apply<Contract extends MethodContract, Input> = (Contract & {
  input: Input;
})["output"];

/**
 * The primary type used to define JMAP calls for
 * one or more entities.
 */
export type CapabilityMethods<Entity extends string> = {
  [key in Entity]: {
    [method: string]: MethodContract;
  };
};

export type Augment<T extends CapabilityMethods<string>> = {
  [Entity in keyof T]: {
    [Method in keyof T[Entity]]: AugmentMethod<T[Entity][Method]>;
  };
};

export type MethodArguments<Contract extends MethodContract> = {
  [Key in keyof Contract["input"]]: AllowRefs<Contract["input"][Key]>;
} extends infer Args
  ? Args extends { accountId: unknown }
    ? SetOptional<Args, "accountId">
    : Args
  : never;

export type EffectiveMethodInput<Contract extends MethodContract, Args> =
  UnpackRefs<Args> extends infer Input
    ? "accountId" extends keyof Input
      ? SetRequired<Input, "accountId">
      : Contract["input"] extends { accountId: infer AccountId }
        ? Simplify<Input & { accountId: AccountId }>
        : Input
    : never;

export type AugmentMethod<Contract extends MethodContract> = <
  Args extends MethodArguments<Contract>,
>(
  args: Args,
) => JobResult<
  MethodCall<EffectiveMethodInput<Contract, Args>>,
  Apply<Contract, EffectiveMethodInput<Contract, Args>>
>;

/**
 * A partially-configured capability that supports using
 * layers of generics. The first layer captures the {@link Entity}
 * type, while the second layer captures the {@link CapabilityMethods}
 */
export interface ConfigurableCapability<Entity extends string, Urn extends string = string> {
  urn: Urn;
  entities: ReadonlyArray<Entity>;
  withMethods<M extends CapabilityMethods<Entity>>(): Capability<Entity, M, Urn>;
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
