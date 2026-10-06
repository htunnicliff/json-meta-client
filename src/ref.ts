import type { ExtendedJSONPointer, ResultReference } from "jmap-rfc-types";
import type { IsUnknown } from "type-fest";

import type { JobResult } from "./internal/batch.ts";
import type { MethodCall } from "./internal/method-call.ts";
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

export function ref<
  Output,
  const Pointer extends (IsUnknown<Output> extends true
    ? ExtendedJSONPointer
    : PointerPaths<Output>),
>(
  methodCall: JobResult<MethodCall<unknown>, Output>,
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
