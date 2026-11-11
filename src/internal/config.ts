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
import { CapabilityConfigurationError, ConfigurationError } from "../errors.ts";
import type { CapabilityOption, Config } from "../types.ts";

/**
 * Constructor validation mechanism
 */
export function assertValidConfig(options: Config<ReadonlyArray<CapabilityOption>>): void {
  const { auth, capabilities: givenCapabilities, sessionUrl } = options;

  // Authentication
  const isAuthCallback = typeof auth === "function";

  const isAuthObject = auth !== null && typeof auth === "object";

  const isBearerAuth = typeof auth === "string" && auth.trim().length > 0;

  const isBasicAuth =
    isAuthObject &&
    typeof auth.username === "string" &&
    auth.username.trim().length > 0 &&
    !auth.username.includes(":") &&
    typeof auth.password === "string";

  const validAuth = isAuthCallback || isBearerAuth || isBasicAuth;

  if (!validAuth) {
    throw new ConfigurationError(
      "`auth` must be a non-empty token string, a username and password, or a callback",
      {
        cause: { auth },
      },
    );
  }

  // Session URL
  if (!URL.canParse(sessionUrl)) {
    throw new ConfigurationError("`sessionUrl` must be a valid URL string or URL instance", {
      cause: { sessionUrl },
    });
  }

  // Capabilities
  if (!Array.isArray(givenCapabilities)) {
    throw new ConfigurationError("`capabilities` must be an array", {
      cause: { capabilities: givenCapabilities },
    });
  }

  for (const capability of givenCapabilities) {
    if (typeof capability === "string") {
      if (!Object.hasOwn(BUILT_IN_CAPABILITIES, capability)) {
        throw new CapabilityConfigurationError(`Unknown built-in capability: ${capability}`, {
          capability,
        });
      }
      continue;
    }

    if (typeof capability.urn !== "string") {
      throw new CapabilityConfigurationError("Capabilities must have a `urn`", { capability });
    }

    if (
      !Array.isArray(capability.entities) ||
      !capability.entities.every((entity: unknown) => typeof entity === "string")
    ) {
      throw new CapabilityConfigurationError(
        "Capability entities must be an array of entity name strings",
        { capability },
      );
    }

    if (
      capability.requires !== undefined &&
      (!Array.isArray(capability.requires) ||
        !capability.requires.every((urn: unknown) => typeof urn === "string"))
    ) {
      throw new CapabilityConfigurationError(
        "Capability `requires` must be an array of URN strings",
        { capability },
      );
    }
  }
}
