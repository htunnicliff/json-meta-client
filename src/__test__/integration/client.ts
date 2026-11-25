import { randomUUID } from "node:crypto";

import { inject } from "vitest";

import type { DefaultCapabilities } from "../../built-ins.ts";
import { JsonMetaClient } from "../../index.ts";
import type { CapabilityOption, ClientApi, Config } from "../../types.ts";

type IntegrationClient<T extends ReadonlyArray<CapabilityOption>> = JsonMetaClient<
  T,
  ClientApi<T> & ClientApi<DefaultCapabilities>
>;

/**
 * Create a client for the provisioned Stalwart user
 */
export function createClient<const T extends ReadonlyArray<CapabilityOption>>(
  ...capabilities: T
): IntegrationClient<T> {
  return createClientWith<T>({}, ...capabilities);
}

/**
 * Create a client for the provisioned Stalwart user, replacing its
 * credentials, adding hooks or choosing a transport
 */
export function createClientWith<const T extends ReadonlyArray<CapabilityOption>>(
  options: Partial<Pick<Config<T>, "auth" | "hooks" | "transport">>,
  ...capabilities: T
): IntegrationClient<T> {
  const { sessionUrl, username, password } = inject("stalwart");
  return new JsonMetaClient({
    sessionUrl,
    capabilities,
    auth: { username, password },
    ...options,
  });
}

/**
 * A name no other test uses, since every test shares one account
 */
export function uniqueName(prefix: string): string {
  return `${prefix} ${randomUUID()}`;
}
