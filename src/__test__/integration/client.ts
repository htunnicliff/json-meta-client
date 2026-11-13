// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

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
 * credentials or adding hooks
 */
export function createClientWith<const T extends ReadonlyArray<CapabilityOption>>(
  options: Partial<Pick<Config<T>, "auth" | "hooks">>,
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
