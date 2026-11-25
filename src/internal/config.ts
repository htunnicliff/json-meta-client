import { BUILT_IN_CAPABILITIES, getCapabilitiesForBuiltIns } from "../built-ins.ts";
import { CapabilityConfigurationError, ConfigurationError } from "../errors/index.ts";
import type { Auth, CapabilityOption, Config } from "../types.ts";

/**
 * Constructor validation mechanism
 */
export function assertValidConfig(options: Config<ReadonlyArray<CapabilityOption>>): void {
  assertValidAuth(options.auth);
  assertValidSessionUrl(options.sessionUrl);
  assertValidCapabilities(options.capabilities);
  assertValidTransport(options.transport);
  assertValidOnWarning(options.onWarning);
}

function assertValidOnWarning(onWarning: unknown): void {
  if (onWarning !== undefined && typeof onWarning !== "function") {
    throw new ConfigurationError("`onWarning` must be a function", { cause: { onWarning } });
  }
}

function assertValidTransport(transport: unknown): void {
  if (transport !== undefined && typeof transport !== "function") {
    throw new ConfigurationError(
      "`transport` must be a transport factory, such as `httpTransport()` or `webSocketTransport()`",
      { cause: { transport } },
    );
  }
}

function assertValidAuth(auth: Auth): void {
  const isCallback = typeof auth === "function";

  const isBearerToken = typeof auth === "string" && auth.trim().length > 0;

  const isBasicCredentials =
    typeof auth === "object" &&
    auth !== null &&
    typeof auth.username === "string" &&
    auth.username.trim().length > 0 &&
    !auth.username.includes(":") &&
    typeof auth.password === "string";

  if (!isCallback && !isBearerToken && !isBasicCredentials) {
    throw new ConfigurationError(
      "`auth` must be a non-empty token string, a username and password, or a callback",
      { cause: { auth } },
    );
  }
}

function assertValidSessionUrl(sessionUrl: string | URL): void {
  if (!URL.canParse(sessionUrl)) {
    throw new ConfigurationError("`sessionUrl` must be a valid URL string or URL instance", {
      cause: { sessionUrl },
    });
  }
}

function assertValidCapabilities(capabilities: ReadonlyArray<CapabilityOption>): void {
  if (!Array.isArray(capabilities)) {
    throw new ConfigurationError("`capabilities` must be an array", {
      cause: { capabilities },
    });
  }

  for (const capability of capabilities) {
    assertValidCapability(capability);
  }

  // A capability that extends another's method contracts needs that one too.
  const resolved = getCapabilitiesForBuiltIns(capabilities);
  const urns = new Set(resolved.map(({ urn }) => urn));
  for (const capability of resolved) {
    if (
      "extends" in capability &&
      typeof capability.extends === "string" &&
      !urns.has(capability.extends)
    ) {
      throw new CapabilityConfigurationError(
        `The ${describeCapability(capability.urn)} capability requires ${describeCapability(capability.extends)}`,
        { capability },
      );
    }
  }
}

function assertValidCapability(capability: CapabilityOption): void {
  if (typeof capability === "string") {
    if (!Object.hasOwn(BUILT_IN_CAPABILITIES, capability)) {
      throw new CapabilityConfigurationError(`Unknown built-in capability: ${capability}`, {
        capability,
      });
    }
    return;
  }

  const { urn, entities, dependsOn, defaultAccount } = capability;

  if (typeof urn !== "string") {
    throw new CapabilityConfigurationError("Capabilities must have a `urn`", { capability });
  }

  if (!isStringArray(entities)) {
    throw new CapabilityConfigurationError(
      "Capability entities must be an array of entity name strings",
      { capability },
    );
  }

  if (dependsOn !== undefined && !isStringArray(dependsOn)) {
    throw new CapabilityConfigurationError(
      "Capability `dependsOn` must be an array of URN strings",
      { capability },
    );
  }

  if (defaultAccount !== undefined && !isDefaultAccountSetting(defaultAccount)) {
    throw new CapabilityConfigurationError(
      'Capability `defaultAccount` must be an object whose values are "primary" or null',
      { capability },
    );
  }
}

function isStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === "string");
}

function isDefaultAccountSetting(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (account: unknown) => account === "primary" || account === null || account === undefined,
    )
  );
}

/** A built-in capability's name in backticks, or else its URN. */
function describeCapability(urn: string): string {
  const name = Object.entries(BUILT_IN_CAPABILITIES).find(
    ([, capability]) => capability.urn === urn,
  )?.[0];
  return name === undefined ? urn : `\`${name}\``;
}
