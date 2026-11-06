// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { core } from "./capabilities/core.ts";
import * as BUILT_IN_CAPABILITIES from "./capabilities/index.ts";
import type { Capability } from "./capability.ts";
import { CapabilityConfigurationError } from "./errors.ts";

export { BUILT_IN_CAPABILITIES };

/**
 * Keys that can be used to reference built-in capabilities
 */
export type BuiltInCapabilityName = keyof typeof BUILT_IN_CAPABILITIES;

/**
 * Capabilities that are always included
 */
export const DEFAULT_CAPABILITIES: [typeof core] = [core];
export type DefaultCapabilities = typeof DEFAULT_CAPABILITIES;

/**
 * Load built-in capabilities from their string keys
 */
export function getCapabilitiesForBuiltIns(
  capabilities: ReadonlyArray<Capability | string>,
): Capability[] {
  return capabilities.map((capability) => {
    if (typeof capability === "string") {
      if (!Object.hasOwn(BUILT_IN_CAPABILITIES, capability)) {
        throw new CapabilityConfigurationError(`Unknown built-in capability: ${capability}`, {
          capability,
        });
      }
      // oxlint-disable-next-line import/namespace typescript/no-unsafe-type-assertion
      return BUILT_IN_CAPABILITIES[capability as keyof typeof BUILT_IN_CAPABILITIES];
    }

    return capability;
  });
}
