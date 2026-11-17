// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { MethodCall } from "../internal/method-call.ts";
import { JsonMetaError } from "./json-meta-error.ts";

/**
 * Why the client rejected a method call's result reference before sending it:
 *
 * - `"nested"`: a reference appears inside an argument's value instead of as
 *   a whole, top-level argument
 * - `"duplicate-argument"`: the arguments name both `foo` and `#foo`
 * - `"cross-batch"`: a reference names a method call that isn't earlier in
 *   the same batch
 * - `"duplicate-id"`: another method call in the batch already uses the
 *   method call's ID
 */
export type ResultReferenceErrorReason =
  | "nested"
  | "duplicate-argument"
  | "cross-batch"
  | "duplicate-id";

/**
 * An error for a method call that would break the rules RFC 8620 §3.7 sets
 * for result references. The client rejects the method call before sending
 * it, and the rest of its batch proceeds.
 */
export class ResultReferenceError extends JsonMetaError {
  override name = "ResultReferenceError";

  constructor(
    message: string,
    options: {
      reason: ResultReferenceErrorReason;
      methodCall: MethodCall<object>;
      path?: string;
      resultOf?: string;
    },
  ) {
    super(message);
    this.reason = options.reason;
    this.methodCall = options.methodCall;
    this.path = options.path;
    this.resultOf = options.resultOf;
  }

  /**
   * Which rule the method call breaks
   */
  readonly reason: ResultReferenceErrorReason;

  /**
   * The rejected method call
   */
  readonly methodCall: MethodCall<object>;

  /**
   * The JSON Pointer, within the method call's arguments, of the misplaced
   * reference (`"nested"`) or the duplicated argument (`"duplicate-argument"`)
   */
  readonly path: string | undefined;

  /**
   * The method call ID that the reference names (`"cross-batch"`)
   */
  readonly resultOf: string | undefined;
}

export function isResultReferenceError(input: unknown): input is ResultReferenceError {
  return input instanceof ResultReferenceError;
}
