import type { ExtendedJSONPointer, ResultReference } from "jmap-rfc-types";
import type { IsUnknown } from "type-fest";

import type { ExtractByPointer, PointerPaths } from "./types.ts";

const refSymbol: unique symbol = Symbol("ref");

/**
 * A JMAP result reference carrying the type extracted by its JSON Pointer.
 */
export type Ref<T = unknown> = ResultReference & {
  readonly [refSymbol]: true;
  /** Phantom carrier for the type at `path`. */
  readonly __type?: T;
};

export type RefFn<Output> = <
  const Pointer extends (IsUnknown<Output> extends true
    ? ExtendedJSONPointer
    : PointerPaths<Output>),
>(
  pointer: Pointer,
) => Ref<ExtractByPointer<Output, Pointer>>;

export type WithRefFn<T extends object, Output> = T & { ref: RefFn<Output> };

export function isRef(input: unknown): input is Ref {
  return typeof input === "object" && input !== null && Object.hasOwn(input, refSymbol);
}

/**
 * Augment an object with the #ref() method for a given method call
 */
export function addRefMethod<Output, T extends object>(
  obj: T,
  { name, resultOf }: Pick<ResultReference, "name" | "resultOf">,
): WithRefFn<T, Output> {
  const ref: RefFn<Output> = (pointer) => {
    return {
      name,
      resultOf,
      path: pointer,
      [refSymbol]: true,
    };
  };

  return Object.assign(obj, { ref });
}
