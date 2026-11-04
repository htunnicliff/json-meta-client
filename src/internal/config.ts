/**
 * Copyright (c) 2026 Hunter Tunnicliff
 *
 * This source code is subject to the terms of the Mozilla Public
 * License, version 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { BUILT_IN_CAPABILITIES } from "../built-ins.ts";
import { CapabilityConfigurationError, ConfigurationError } from "../errors.ts";
import type { CapabilityOption, Config } from "../types.ts";

/**
 * Constructor validation mechanism
 */
export function assertValidConfig(options: Config<ReadonlyArray<CapabilityOption>>): void {
  const { bearerToken, capabilities: givenCapabilities, sessionUrl, middleware } = options;

  // Bearer token
  if (typeof bearerToken !== "string" || bearerToken.trim().length === 0) {
    throw new ConfigurationError("`bearerToken` must be a non-empty string", {
      cause: { bearerToken },
    });
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
  }

  // Middleware
  if (middleware) {
    if (!Array.isArray(middleware) || !middleware.every((fn) => typeof fn === "function")) {
      throw new ConfigurationError("`middleware` must be an array of functions", {
        cause: { middleware },
      });
    }
  }
}
