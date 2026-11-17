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
  ArrayElement,
  IsUnknown,
  KeysOfUnion,
  Paths,
  Primitive,
  Replace,
  SetOptional,
  SetRequired,
  Simplify,
} from "type-fest";

import type { CapabilityMethods, MethodContract } from "../capability.ts";
import type { Ref, WithResultRefFn } from "./ref.ts";

/**
 * Extracts the type produced by evaluating a JMAP JSON Pointer against `T`.
 *
 * Supports three navigation patterns:
 * - Property access: `/foo/bar` navigates nested object keys
 * - Numeric index: `/list/0/name` accesses array indices by number literal
 * - Array wildcard: `/list/<star>/name` maps through every element,
 *   collecting results into an array. When the rest of the pointer yields
 *   an array for an element, its contents are added individually, so
 *   `/list/<star>/emailIds` gives `string[]` (per RFC 8620 §3.7)
 *
 * Returns `never` for invalid paths, such as a wildcard applied to a non-array.
 */
export type ExtractByPointer<T, Pointer extends string> =
  IsUnknown<T> extends true
    ? unknown
    : Pointer extends `/${infer Segments}`
      ? ResolveSegments<T, Segments>
      : never;

/** Walks the pointer's remaining segments, one per step, starting from `T`. */
type ResolveSegments<T, Segments extends string> = Segments extends ""
  ? T
  : Segments extends `${infer First}/${infer Rest}`
    ? ResolveSegment<T, First, Rest>
    : ResolveSegment<T, Segments, "">;

/** Navigates one segment into `T`, then resolves the `Rest` of the pointer. */
type ResolveSegment<T, Segment extends string, Rest extends string> = Segment extends "*"
  ? // Wildcard: resolve the rest against each element, collecting an array
    T extends ReadonlyArray<infer Element>
    ? Array<FlattenOnce<ResolveSegments<Element, Rest>>>
    : never
  : Segment extends `${number}`
    ? // Numeric index: an array element, or a character of a string
      T extends ReadonlyArray<infer Element>
      ? ResolveSegments<Element, Rest>
      : T extends string
        ? ResolveSegments<string, Rest>
        : never
    : // Named property
      Segment extends keyof T
      ? ResolveSegments<T[Segment], Rest>
      : never;

/**
 * The items a wildcard adds to its output for one resolved value: the
 * contents of an array, or any other value as itself (RFC 8620 §3.7).
 */
type FlattenOnce<T> = T extends ReadonlyArray<infer Item> ? Item : T;

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

/** The name, `Entity/method`, of each method in a {@link CapabilityMethods} map. */
export type MethodName<Methods> = {
  [Entity in keyof Methods & string]: `${Entity}/${keyof Methods[Entity] & string}`;
}[keyof Methods & string];

declare const withoutDefaultAccountId: unique symbol;

/**
 * Marks a method contract whose calls the client gives no default
 * `accountId`, so callers must pass one.
 */
export interface WithoutDefaultAccountId {
  readonly [withoutDefaultAccountId]: true;
}

/**
 * The default account that a capability's setting gives `Name`: the listed
 * value, else the `"*"` value, else `undefined` when the capability doesn't
 * claim the method. An omitted setting claims every method as `"primary"`.
 */
type ResolveDefaultAccount<Setting, Name extends string> = [Setting] extends [undefined]
  ? "primary"
  : Name extends keyof Setting
    ? [Setting[Name]] extends [undefined]
      ? WildcardDefaultAccount<Setting>
      : Setting[Name]
    : WildcardDefaultAccount<Setting>;

type WildcardDefaultAccount<Setting> = "*" extends keyof Setting ? Setting["*"] : undefined;

/**
 * Marks each method in a capability's {@link CapabilityMethods} that the
 * client gives no default `accountId`: the capability sets it to `null`
 * (listed, or through `"*"`), or doesn't claim it at all.
 */
export type MarkDefaultAccounts<Methods, Setting> = {
  [Entity in keyof Methods]: {
    [Method in keyof Methods[Entity]]: [
      ResolveDefaultAccount<Setting, `${Entity & string}/${Method & string}`>,
    ] extends [null | undefined]
      ? Methods[Entity][Method] & WithoutDefaultAccountId
      : Methods[Entity][Method];
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
      `${Entity & string}/${Method & string}`
    >;
  };
};

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

/**
 * The arguments a caller passes for a method call. `accountId` is optional
 * because the client fills it in, except for contracts marked
 * {@link WithoutDefaultAccountId}.
 */
export type MethodArguments<Contract extends MethodContract> = {
  [Key in keyof AcceptedInput<Contract>]: AllowRefs<AcceptedInput<Contract>[Key]>;
} extends infer Args
  ? Args extends { accountId: unknown }
    ? Contract extends WithoutDefaultAccountId
      ? Args
      : SetOptional<Args, "accountId">
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
  ? { [Index in keyof Given]: UnknownProperties<Given[Index], ArrayElement<Accepted>> }
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

export type AugmentMethod<Contract extends MethodContract, Name extends string = string> = <
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
} & (Name extends `${string}/set`
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
