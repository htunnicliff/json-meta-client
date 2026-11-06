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
 * An unexpected error associated with a specific method call
 */
export class MethodCallError extends JsonMetaError {
  override name = "MethodCallError";

  constructor(
    message: string,
    options: {
      methodCall: MethodCall<object>;
      responseData?: unknown;
    },
  ) {
    super(message);
    this.methodCall = options.methodCall;
    this.responseData = options.responseData;
  }

  /**
   * The given method call sent in a request
   */
  readonly methodCall: MethodCall<object>;

  /**
   * The response body, if it exists
   */
  readonly responseData: unknown;
}

export function isMethodCallError(input: unknown): input is MethodCallError {
  return input instanceof MethodCallError;
}
