import type { ResultReference } from "jmap-rfc-types";
import type { Primitive } from "type-fest";

import type { BatchResult } from "./internal/batcher.ts";
import type { MethodCall } from "./internal/method-calls.ts";
import type { ExtractByPointer, PointerPaths } from "./internal/types.ts";

const refSymbol: unique symbol = Symbol("ref");

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
