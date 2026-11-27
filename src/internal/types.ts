import type { CapabilityMethods, MethodContract } from "../capability.ts";
import type { Patch } from "../rfc-types/core/index.ts";
import type { Ref, WithResultRefFn } from "./ref.ts";
import type {
  ArrayElement,
  IsUnknown,
  KeysOfUnion,
  SetOptional,
  SetRequired,
  Simplify,
} from "./type-utils.ts";

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

/**
 * Allow JMAP `*` in place of any numeric array-index segment (RFC 8620 §3.7).
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
 * Union of JSON Pointers that {@link ExtractByPointer} can resolve against `T`,
 * with JMAP wildcards in place of array indexes.
 */
export type PointerPaths<T> =
  PathSegments<T> extends infer Path
    ? Path extends string
      ? WithArrayWildcards<`/${Path}`>
      : never
    : never;

/** How many segments below the first a pointer may have. */
type MaxPathDepth = 5;

/** Values a pointer can't descend into. */
type LeafValue =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined
  | ((...args: never) => unknown)
  | ReadonlyMap<unknown, unknown>
  | ReadonlySet<unknown>
  | WeakMap<WeakKey, unknown>
  | WeakSet<WeakKey>;

/**
 * Every path of property names and array indexes into `T`, joined by `/`,
 * down to {@link MaxPathDepth}. Array indexes are `${number}`.
 */
type PathSegments<T, Depth extends unknown[] = []> = T extends LeafValue
  ? never
  : 0 extends 1 & T
    ? never
    : T extends object
      ? PathSegmentsOf<Required<T>, PathKeys<Required<T>>, Depth>
      : never;

/** The keys a pointer can follow: indexes for arrays, otherwise every key. */
type PathKeys<T> = T extends readonly unknown[] ? keyof T & number : keyof T;

type PathSegmentsOf<T, Keys, Depth extends unknown[]> = {
  [Key in Keys & keyof T]: Key extends string | number
    ? | `${Key}`
      | (Depth["length"] extends MaxPathDepth
          ? never
          : `${Key}/${PathSegments<T[Key], [...Depth, unknown]> & string}`)
    : never;
}[Keys & keyof T];

/**
 * Allows a {@link Ref} of the expected value in place of the value itself.
 * RFC 8620 §3.7 marks a result reference by prefixing an argument's name with
 * `#`, so the proxy API accepts a `Ref` only as a whole, top-level argument.
 */
export type AllowRef<T> = T | Ref<T>;

/** The type a {@link Ref} resolves to, or `T` itself when it isn't one. */
type UnpackRef<T> = T extends Ref<infer U> ? U : T;

/**
 * Replaces each top-level {@link Ref} argument with the type it resolves to.
 * Used when deriving method response types from arguments that may contain refs.
 */
export type UnpackRefs<T> = { [K in keyof T]: UnpackRef<T[K]> };

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
  [Key in keyof AcceptedInput<Contract>]: AllowRef<AcceptedInput<Contract>[Key]>;
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
 * leaves open (`unknown`, `object` or an index signature), result
 * references, and `patch()` values are not inspected.
 */
export type UnknownProperties<Given, Accepted> = [Given] extends [never]
  ? unknown
  : [Extract<Given, Ref | Patch<unknown>>] extends [never]
    ? CheckUnknownProperties<Given, Accepted>
    : unknown;

type CheckUnknownProperties<Given, Accepted> = [Given] extends [ReadonlyArray<unknown>]
  ? { [Index in keyof Given]: UnknownProperties<Given[Index], ArrayElement<Accepted>> }
  : [Given] extends [object]
    ? [KeysOfUnion<NonNullable<Accepted>>] extends [never]
      ? unknown
      : {
          // `null` passes here, and the accepted type decides whether it may
          [Key in KeysOfUnion<Given>]?: StoredKey<Key> extends KeysOfUnion<NonNullable<Accepted>>
            ? UnknownProperties<
                NonNullable<PropertyOfUnion<Given, Key>>,
                PropertyOfUnion<NonNullable<Accepted>, Key>
              > | null
            : never;
        }
    : unknown;

export interface AugmentedOptions {
  id?: string;
}

/**
 * A method on the client's API. When the contract requires no arguments
 * once the client fills in `accountId`, the arguments can be left out, as
 * in `client.api.Mailbox.get()`.
 */
export type AugmentMethod<Contract extends MethodContract, Name extends string = string> = <
  // Without arguments, `Args` has nothing to infer from and is `{}`
  // oxlint-disable-next-line typescript/no-generated-empty-object-type
  Args extends MethodArguments<Contract> = Extract<Record<never, never>, MethodArguments<Contract>>,
  Output extends Apply<Contract, EffectiveMethodInput<Contract, Args>> = Apply<
    Contract,
    EffectiveMethodInput<Contract, Args>
  >,
>(
  // oxlint-disable-next-line typescript/no-generated-empty-object-type
  ...params: Record<never, never> extends MethodArguments<Contract>
    ? [
        args?: Args & NoInfer<UnknownProperties<Args, AcceptedInput<Contract>>>,
        options?: AugmentedOptions,
      ]
    : [
        args: Args & NoInfer<UnknownProperties<Args, AcceptedInput<Contract>>>,
        options?: AugmentedOptions,
      ]
) => AugmentedResult<Name, Args, Output>;

/**
 * What a method call returns: its pending result, with the call's details
 * and reference helpers
 */
type AugmentedResult<Name extends string, Args, Output> = WithResultRefFn<
  Promise<Output>,
  Output
> & {
  readonly $id: string;
  readonly $args: Args;
  readonly $method: string;
} & (Name extends `${string}/set`
    ? {
        /**
         * Reference an object created by this /set call using its creation ID.
         * The call consuming this reference must be queued in the same batch.
         *
         * @throws {CreationReferenceError} when `create` has no such ID, or
         * when this call's batch was already sent
         */
        createdRef: <
          Key extends keyof NonNullable<Args extends { create?: infer C } ? C : never> & string,
        >(
          id: Key,
        ) => `#${Key}`;
      }
    : {});
