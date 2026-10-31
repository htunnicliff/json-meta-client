import { inject } from "vitest";

import type { DefaultCapabilities } from "../../built-ins.ts";
import { JsonMetaClient } from "../../index.ts";
import type { CapabilityOption, ClientApi } from "../../types.ts";

export function createClient<const T extends ReadonlyArray<CapabilityOption>>(
  ...capabilities: T
): JsonMetaClient<T, ClientApi<T> & ClientApi<DefaultCapabilities>> {
  const { sessionUrl, username, password } = inject("stalwart");
  const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

  return new JsonMetaClient({
    sessionUrl,
    capabilities,
    bearerToken: "unused-with-basic-auth-hook",
    hooks: {
      beforeRequest: [
        ({ request }) => {
          // Stalwart accepts Basic auth; exercise the client's public request hook.
          request.headers.set("authorization", authorization);
          return request;
        },
      ],
    },
  });
}
