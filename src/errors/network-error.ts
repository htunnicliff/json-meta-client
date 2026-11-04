/**
 * Copyright (c) 2026 Hunter Tunnicliff
 *
 * This source code is subject to the terms of the Mozilla Public
 * License, version 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { JsonMetaError } from "./json-meta-error.ts";

/**
 * An error occurring at the network level.
 *
 * This is not used for HTTP errors, as those
 * are represented by `HttpError`.
 */
export class NetworkError extends JsonMetaError {
  override name = "NetworkError";

  constructor(message: string, options: { cause: unknown; request: Request | undefined }) {
    super(message);
    this.cause = options.cause;
    this.request = options.request;
  }

  /**
   * The request that was sent, if available
   */
  readonly request: Request | undefined;
}

export function isNetworkError(input: unknown): input is NetworkError {
  return input instanceof NetworkError;
}
