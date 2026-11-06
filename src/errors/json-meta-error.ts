// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

export class JsonMetaError extends Error {
  override name = "JsonMetaError";
}

export function isJsonMetaError(input: unknown): input is JsonMetaError {
  return input instanceof JsonMetaError;
}
