import type { ResultReference } from "jmap-rfc-types";
import type { JsonValue, Paths, Primitive, Replace } from "type-fest";

import type { BatchResult } from "./batcher.ts";
import type { MethodCall } from "./method-calls.ts";

const refSymbol = Symbol("ref");

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

/**
 * A JMAP result reference carrying the type extracted by its JSON Pointer.
 */
export type Ref<T = unknown> = ResultReference & {
  readonly [refSymbol]: true;
  /** Phantom carrier for the type at `path`. */
  readonly __type?: T;
};

/**
 * Deeply allows a {@link Ref} of the expected value at any position.
 * Used by the proxy API so callers may pass `ref(...)` in place of concrete args.
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

export function ref<Output, const Pointer extends PointerPaths<Output>>(
  methodCall: BatchResult<MethodCall<unknown>, Output>,
  pointer: Pointer,
): Ref<ExtractByPointer<Output, Pointer>> {
  return {
    name: methodCall.method,
    resultOf: methodCall.id,
    path: pointer,
    [refSymbol]: true,
  };
}

export function isRef(input: unknown): input is Ref {
  return typeof input === "object" && input !== null && Object.hasOwn(input, refSymbol);
}

/**
 * Recursively detect any objects containing result references,
 * updating their keys to use a # prefix
 */
export function replaceNestedResultRefKeys(input: JsonValue): JsonValue {
  if (Array.isArray(input)) {
    return input.map((item) => replaceNestedResultRefKeys(item));
  }

  if (typeof input === "object" && input !== null) {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => {
        if (isRef(value)) {
          return [`#${key}`, value];
        }

        return [key, replaceNestedResultRefKeys(value)];
      }),
    );
  }

  return input;
}
