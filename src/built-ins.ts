// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import {
  blob,
  "community:maskedEmail" as maskedEmail,
  contacts,
  core,
  mail,
  mdn,
  quota,
  sharing,
  sieve,
  smime,
  submission,
  vacationResponse,
} from "./capabilities/index.ts";
import type { Capability } from "./capability.ts";
import { CapabilityConfigurationError } from "./errors.ts";

/**
 * Built-in capabilities by the names that configure them. A plain object
 * rather than a module namespace, so the bundle needs no namespace helper.
 */
export const BUILT_IN_CAPABILITIES: {
  readonly blob: typeof blob;
  readonly contacts: typeof contacts;
  readonly core: typeof core;
  readonly mail: typeof mail;
  readonly mdn: typeof mdn;
  readonly quota: typeof quota;
  readonly sharing: typeof sharing;
  readonly sieve: typeof sieve;
  readonly smime: typeof smime;
  readonly submission: typeof submission;
  readonly vacationResponse: typeof vacationResponse;
  readonly "community:maskedEmail": typeof maskedEmail;
} = Object.freeze({
  blob,
  contacts,
  core,
  mail,
  mdn,
  quota,
  sharing,
  sieve,
  smime,
  submission,
  vacationResponse,
  "community:maskedEmail": maskedEmail,
});

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
