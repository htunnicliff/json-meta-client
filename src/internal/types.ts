// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type {
  IsUnknown,
  JsonValue,
  Paths,
  Primitive,
  Replace,
  SetOptional,
  SetRequired,
  Simplify,
} from "type-fest";

import type { Capability, MethodContract } from "../capability.ts";
import type { Ref, WithResultRefFn } from "./ref.ts";

/** Extracts the type produced by evaluating a JMAP JSON Pointer against `T`.

 Supported three navigation patterns:
 - Property access: /foo/bar navigates nested object keys
 - Numeric index: /list/0/name accesses array indices by number literal
 - Array wildcard: /list/<star>/name maps through every element, collecting results into an array (per RFC 8620 §3.7)
 Returns never for invalid paths (e.g., applying a wildcard to a non-array).
*/
export type ExtractByPointer<T, Pointer extends string> =
  IsUnknown<T> extends true ? unknown : _EBS<Pointer, T>;

/** Strip leading slash then dispatch to recursive handler */
type _EBS<P extends string, T> = P extends `/${infer Rest}` ? _EBR<T, Rest> : never;

/** Recursive extractor: split first segment from rest, navigate into T */
type _EBR<T, Segments extends string> =
  // Zero segments left - return the resolved type
  Segments extends ""
    ? T
    : // Two or more segments remaining: First/Remaining (e.g., "foo/bar")
      Segments extends `${infer First}/${infer Remaining}`
      ? First extends "*" // wildcard: map each element, collect into an array
        ? T extends ReadonlyArray<infer E>
          ? Array<_EBR<E, Remaining>>
          : never
        : First extends `${number}` // numeric index mid-path
          ? T extends ReadonlyArray<infer E>
            ? _EBR<E, Remaining>
            : T extends string
              ? _EBR<string, Remaining>
              : never
          : First extends keyof T // named property: descend
            ? _EBR<T[First], Remaining>
            : never
      : // Exactly one segment: could be "*", a numeric index, or a named property
        Segments extends "*" // standalone wildcard -> array of element types
        ? T extends ReadonlyArray<infer E>
          ? E[]
          : never
        : Segments extends `${number}` // numeric index - take the array/string element type
          ? T extends ReadonlyArray<infer E>
            ? E
            : T extends string
              ? string
              : never
          : Segments extends keyof T // named property with no continuation
            ? T[Segments]
            : never;

/** Convert a type-fest dot path into a JSON Pointer. */
type DotPathToPointer<Path extends string> = `/${Replace<Path, ".", "/", { all: true }>}`;

/**
 * Allow JMAP `*` in place of any numeric array-index segment
 * (RFC 8620 §3.7), which type-fest's {@link Paths} does not model.
 */
type WithArrayWildcards<Pointer extends string> = Pointer extends `/${infer Rest}`
  ? `/${WithArrayWildcardsInner<Rest>}`
  : never;

type WithArrayWildcardsInner<Rest extends string> = Rest extends `${infer Seg}/${infer Tail}`
  ? Seg extends `${number}`
    ? `${number}/${WithArrayWildcardsInner<Tail>}` | `*/${WithArrayWildcardsInner<Tail>}`
    : `${Seg}/${WithArrayWildcardsInner<Tail>}`
  : Rest extends `${number}`
    ? `${number}` | `*`
    : Rest;

/**
 * Union of JSON Pointers that {@link ExtractByPointer} can resolve against `T`.
 * Built from type-fest {@link Paths}, remapped to pointer syntax with JMAP wildcards.
 */
export type PointerPaths<T> =
  Paths<T> extends infer Path
    ? Path extends string
      ? WithArrayWildcards<DotPathToPointer<Path>>
      : never
    : never;

export type Middleware = (payload: JsonValue) => JsonValue;

/**
 * Deeply allows a {@link Ref} of the expected value at any position.
 * Used by the proxy API so callers may pass `resultRef(...)` in place of concrete args.
 */
export type AllowRefs<T> =
  | Ref<T>
  | (T extends Primitive
      ? T
      : T extends readonly [any, ...any[]]
        ? { [K in keyof T]: AllowRefs<T[K]> }
        : T extends readonly any[]
          ? { [K in keyof T]: AllowRefs<T[number]> }
          : T extends object
            ? { [K in keyof T]: AllowRefs<T[K]> }
            : T);

/**
 * Deeply replaces {@link Ref} wrappers with the types they resolve to.
 * Used when deriving method response types from arguments that may contain refs.
 */
export type UnpackRefs<T> =
  T extends Ref<infer U>
    ? U
    : T extends Primitive
      ? T
      : T extends readonly [any, ...any[]]
        ? { [K in keyof T]: UnpackRefs<T[K]> }
        : T extends readonly any[]
          ? Array<UnpackRefs<T[number]>>
          : T extends object
            ? { [K in keyof T]: UnpackRefs<T[K]> }
            : T;

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

/**
 * Builds the client's methods from its capabilities' contracts. A contract
 * that declares an `extensions` field receives `ContractExtensions` there,
 * which it can read as `this["extensions"]` in the same way it reads
 * `this["input"]`. Other contracts are used as they are.
 */
export type Augment<T extends CapabilityMethods<string>, ContractExtensions = unknown> = {
  [Entity in keyof T]: {
    [Method in keyof T[Entity]]: AugmentMethod<
      T[Entity][Method] extends { extensions: unknown }
        ? T[Entity][Method] & { extensions: ContractExtensions }
        : T[Entity][Method],
      Method & string
    >;
  };
};

declare const contractExtensions: unique symbol;

/**
 * A built-in capability that adds no methods of its own. Instead it adds
 * properties or filter conditions to the method contracts of the capability
 * it {@link ExtendingCapability.extends | extends}, such as S/MIME adding
 * `smime*` properties to `Email/get`. Those contract extensions exist only as
 * a type; the client requires the extended capability alongside it.
 */
export interface ExtendingCapability<
  Entity extends string,
  Urn extends string,
  ExtendedUrn extends string,
  AccountCapabilities,
  SessionCapabilities,
  ContractExtensions,
> extends Capability<
  Entity,
  { [Name in Entity]: {} },
  Urn,
  AccountCapabilities,
  SessionCapabilities
> {
  /** The URN of the capability whose method contracts this one extends. */
  extends: ExtendedUrn;
  readonly [contractExtensions]?: ContractExtensions;
}

/** Extracts the contract extensions of an {@link ExtendingCapability}, or `never`. */
export type InferContractExtensions<C> = C extends unknown
  ? typeof contractExtensions extends keyof C
    ? NonNullable<C[typeof contractExtensions]>
    : never
  : never;

/**
 * The arguments a contract accepts: its `acceptedInput` field when it has
 * one, otherwise its `input` field. A contract that reads contract extensions
 * declares `acceptedInput`, because the client intersects `input` with the
 * actual arguments, and `input` can't also depend on `this` there.
 */
type AcceptedInput<Contract extends MethodContract> = Contract extends {
  acceptedInput: infer Input;
}
  ? Input
  : Contract["input"];

export type MethodArguments<Contract extends MethodContract> = {
  [Key in keyof AcceptedInput<Contract>]: AllowRefs<AcceptedInput<Contract>[Key]>;
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

/** Keys of every member of a union, unlike `keyof`, which keeps only shared keys. */
type KeysOfUnion<T> = T extends unknown ? keyof T : never;

/** A property key as JavaScript stores it: numeric keys become strings. */
type StoredKey<Key> = Key extends number ? `${Key}` : Key;

/** The type of `Key` in each member of a union that declares it. */
type PropertyOfUnion<T, Key> = T extends unknown
  ? Key extends keyof T
    ? T[Key]
    : StoredKey<Key> extends keyof T
      ? T[StoredKey<Key>]
      : never
  : never;

/** The element type of each array in a union. */
type ElementOfUnion<T> = T extends ReadonlyArray<infer Element> ? Element : never;

/**
 * Marks every property of `Given` that `Accepted` doesn't declare as
 * `never`, at any depth. Inferred arguments skip TypeScript's excess property
 * check, so without this a misspelled property, or a property that needs a
 * capability the client doesn't have, would compile. Values that `Accepted`
 * leaves open (`unknown`, `object` or an index signature) and result
 * references are not inspected.
 */
export type UnknownProperties<Given, Accepted> = [Given] extends [never]
  ? unknown
  : [Extract<Given, Ref>] extends [never]
    ? CheckUnknownProperties<Given, Accepted>
    : unknown;

type CheckUnknownProperties<Given, Accepted> = [Given] extends [ReadonlyArray<unknown>]
  ? { [Index in keyof Given]: UnknownProperties<Given[Index], ElementOfUnion<Accepted>> }
  : [Given] extends [object]
    ? [KeysOfUnion<NonNullable<Accepted>>] extends [never]
      ? unknown
      : {
          [Key in KeysOfUnion<Given>]?: StoredKey<Key> extends KeysOfUnion<NonNullable<Accepted>>
            ? UnknownProperties<
                NonNullable<PropertyOfUnion<Given, Key>>,
                PropertyOfUnion<NonNullable<Accepted>, Key>
              >
            : never;
        }
    : unknown;

export interface AugmentedOptions {
  id?: string;
}

export type AugmentMethod<Contract extends MethodContract, Method extends string = string> = <
  Args extends MethodArguments<Contract>,
  Output extends Apply<Contract, EffectiveMethodInput<Contract, Args>> = Apply<
    Contract,
    EffectiveMethodInput<Contract, Args>
  >,
>(
  args: Args & NoInfer<UnknownProperties<Args, AcceptedInput<Contract>>>,
  options?: AugmentedOptions,
) => WithResultRefFn<Promise<Output>, Output> & {
  readonly $id: string;
  readonly $args: Args;
  readonly $method: string;
} & (Method extends "set"
    ? {
        /**
         * Reference an object created by this /set call using its creation ID.
         * The call consuming this reference must be queued in the same batch.
         */
        createdRef: <
          Key extends keyof NonNullable<Args extends { create?: infer C } ? C : never> & string,
        >(
          id: Key,
        ) => `#${Key}`;
      }
    : {});

/**
 * A partially-configured capability that supports using
 * layers of generics. The first layer captures the {@link Entity}
 * type, while the second layer captures the {@link CapabilityMethods}
 * and its account and session capability details.
 */
export interface ConfigurableCapability<Entity extends string, Urn extends string = string> {
  urn: Urn;
  entities: ReadonlyArray<Entity>;
  dependsOn?: ReadonlyArray<string>;
  withMethods<
    M extends CapabilityMethods<Entity>,
    AccountCapabilities = unknown,
    SessionCapabilities = unknown,
  >(): Capability<Entity, M, Urn, AccountCapabilities, SessionCapabilities>;
}
