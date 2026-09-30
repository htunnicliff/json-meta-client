import { Client, type ClientOptions, type Middleware } from "json-meta-client";
import { mail } from "json-meta-client/capabilities";

export async function loadMail(sessionUrl: string, bearerToken: string, accountId: string) {
  const middleware: Middleware = (payload, context) => {
    if (context?.method === "Core/echo") return payload;
    if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
      return Object.assign({}, payload, { accountId });
    }
    return payload;
  };
  const options = {
    sessionUrl,
    bearerToken,
    capabilities: [mail],
    middleware: [middleware],
  } satisfies ClientOptions<readonly [typeof mail]>;
  const client = new Client(options);
  await client.session;
  const query = await client.api.Email.query({ limit: 10 });
  return client.api.Email.get({ ids: query.ids, properties: ["id", "subject"] });
}
