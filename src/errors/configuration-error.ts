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
 * An error for client misconfiguration
 */
export class ConfigurationError extends JsonMetaError {
  override name = "ConfigurationError";
}

export function isConfigurationError(input: unknown): input is ConfigurationError {
  return input instanceof ConfigurationError;
}
