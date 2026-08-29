import type { Paths, Replace, SetOptional } from "type-fest";

import type { AllowRefs } from "../ref.ts";

export type OptionalAccountId<Args> = Args extends { accountId: unknown }
  ? SetOptional<Args, "accountId">
  : Args;

/** Allow a result reference in place of any argument value (including nested). */
export type AllowRefsInArgs<Args> = {
  [K in keyof Args]: AllowRefs<Args[K]>;
};

/** Extracts the type produced by evaluating a JMAP JSON Pointer against `T`.

 Supported three navigation patterns:
 - Property access: /foo/bar navigates nested object keys
 - Numeric index: /list/0/name accesses array indices by number literal
 - Array wildcard: /list/<star>/name maps through every element, collecting results into an array (per RFC 8620 §3.7)
 Returns never for invalid paths (e.g., applying a wildcard to a non-array).
*/
export type ExtractByPointer<T, Pointer extends string> = _EBS<Pointer, T>;

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
