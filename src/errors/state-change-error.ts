/**
 * Copyright (c) 2026 Hunter Tunnicliff
 *
 * This source code is subject to the terms of the Mozilla Public
 * License, version 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { JsonMetaError } from "./json-meta-error.ts";

/**
 * An error occurring within a state change listener
 */
export class StateChangeError extends JsonMetaError {
  override name = "StateChangeError";
}

export function isStateChangeError(input: unknown): input is StateChangeError {
  return input instanceof StateChangeError;
}
