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
 * An error for an API call on an entity that no configured capability declares
 */
export class UnknownEntityError extends JsonMetaError {
  override name = "UnknownEntityError";

  /**
   * The entity that no capability declares
   */
  readonly entity: string;

  /**
   * The method that was called on the entity
   */
  readonly method: string;

  constructor(options: { entity: string; method: string }) {
    super(
      `Cannot call ${options.entity}/${options.method}: no configured capability declares the entity "${options.entity}". ` +
        `Add a capability that declares it to \`capabilities\`, using a built-in capability or \`defineCapability\`.`,
    );
    this.entity = options.entity;
    this.method = options.method;
  }
}

export function isUnknownEntityError(input: unknown): input is UnknownEntityError {
  return input instanceof UnknownEntityError;
}
