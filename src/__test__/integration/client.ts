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
  return createClientWith({}, ...capabilities);
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
 * Create a client for the second provisioned Stalwart user, who shares a
 * mailbox and an address book with the main user
 */
export function createOtherClient<const T extends ReadonlyArray<CapabilityOption>>(
  ...capabilities: T
): IntegrationClient<T> {
  const { other } = inject("stalwart");
  return createClientWith(
    { auth: { username: other.username, password: other.password } },
    ...capabilities,
  );
}

/**
 * A name no other test uses, since every test shares one account
 */
export function uniqueName(prefix: string): string {
  return `${prefix} ${randomUUID()}`;
}
