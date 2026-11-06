// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { JsonMetaError } from "./json-meta-error.ts";

/**
 * An error used when a batch result is cancelled
 */
export class CancellationError extends JsonMetaError {
  override name = "CancellationError";
}

export function isCancellationError(input: unknown): input is CancellationError {
  return input instanceof CancellationError;
}
