/**
 * Copyright (c) 2026 Hunter Tunnicliff
 *
 * This source code is subject to the terms of the Mozilla Public
 * License, version 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { InvalidUriTemplateError } from "../errors.ts";

/**
 * Expand an rfc 6570 URI template into a regular URI
 */
export function expandURITemplate(template: string, params: Record<string, string>): string {
  let uri = template;
  for (const [key, value] of Object.entries(params)) {
    const target = `{${key}}`;
    if (!uri.includes(target)) {
      throw new InvalidUriTemplateError(`Template does not contain "${key}"`, {
        template,
        params,
      });
    }
    uri = uri.replace(target, encodeURIComponent(value));
  }
  return uri;
}
