/**
 * Copyright (c) 2026 Hunter Tunnicliff
 *
 * This source code is subject to the terms of the Mozilla Public
 * License, version 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { JsonMetaError } from "./json-meta-error.ts";

/**
 * An error for improper URI template usage
 */
export class InvalidUriTemplateError extends JsonMetaError {
  override name = "InvalidUriTemplateError";

  constructor(
    message: string,
    options: {
      template: string;
      params: Record<string, string>;
    },
  ) {
    super(message);
    this.uriTemplate = options.template;
    this.givenParameters = options.params;
    this.availableParameters = Array.from(
      this.uriTemplate.matchAll(/(?<={)[^{]+(?=})/g),
      ([key]) => key,
    );
  }

  /**
   * URI template supplied for expansion
   */
  readonly uriTemplate: string;

  /**
   * Parameters supplied for expansion
   */
  readonly givenParameters: Record<string, string>;

  /**
   * Actual parameters available within the {@link uriTemplate}
   */
  readonly availableParameters: readonly string[];
}

export function isInvalidUriTemplateError(input: unknown): input is InvalidUriTemplateError {
  return input instanceof InvalidUriTemplateError;
}
