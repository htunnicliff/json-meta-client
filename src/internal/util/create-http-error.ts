// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { HttpError } from "../../errors.ts";
import type { ProblemDetails } from "../../rfc-types/core/rfc8620-jmap.ts";

/**
 * Describe an unsuccessful response, reading its body for the error's details
 */
export async function createHttpError(request: Request, response: Response): Promise<HttpError> {
  let responseData: unknown;
  let cause: unknown;
  try {
    const isJsonResponse = /\bjson\b/i.test(response.headers.get("content-type") ?? "");
    responseData = isJsonResponse ? await response.clone().json() : await response.clone().text();
  } catch (error) {
    cause = error;
  }

  const message =
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    (responseData as ProblemDetails)?.detail ?? `HTTP request failed (${response.status})`;
  return new HttpError(message, { request, response, responseData, cause });
}
