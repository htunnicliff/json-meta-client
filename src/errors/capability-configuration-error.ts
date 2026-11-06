// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { BUILT_IN_CAPABILITIES } from "../built-ins.ts";
import { ConfigurationError } from "./configuration-error.ts";

/**
 * An error for capabilities in a client that are invalid
 */
export class CapabilityConfigurationError extends ConfigurationError {
  override name = "CapabilityConfigurationError";

  /**
   * The supplied capability
   */
  readonly givenCapability: unknown;

  /**
   * Available built-in capabilities accessible via string keys
   */
  get availableBuiltIns(): readonly string[] {
    return Object.keys(BUILT_IN_CAPABILITIES);
  }

  constructor(message: string, options: { capability: unknown }) {
    super(message);
    this.givenCapability = options.capability;
  }
}

export function isCapabilityConfigurationError(
  input: unknown,
): input is CapabilityConfigurationError {
  return input instanceof CapabilityConfigurationError;
}
