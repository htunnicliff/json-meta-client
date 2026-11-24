// Consumer of the packed package, copied into a throwaway project by
// `scripts/check-package.mjs`. `index.ts` is type-checked there against the
// published declarations, then run.

import { defineCapability, JsonMetaClient } from "json-meta-client";
import type { JSContact, MethodGet } from "json-meta-client/rfc-types";

const notes = defineCapability({ urn: "urn:example:notes", entities: ["Note"] }).withMethods<{
  Note: { get: { input: { ids: string[] }; output: { list: { id: string }[] } } };
}>();

interface Bookmark {
  id: string;
  url: string;
  title: string;
}

const bookmarks = defineCapability({
  urn: "urn:example:bookmarks",
  entities: ["Bookmark"],
}).withMethods<{ Bookmark: { get: MethodGet.Contract<Bookmark> } }>();

const options = { auth: "token", sessionUrl: "https://jmap.test/session" } as const;

// Type-only checks: these functions are never called.
export function mailOnly(): unknown {
  const client = new JsonMetaClient({ ...options, capabilities: ["mail"] });
  // @ts-expect-error S/MIME properties need the smime capability.
  return client.api.Email.get({ properties: ["smimeStatus"] });
}
export function withSmime(): unknown {
  const client = new JsonMetaClient({ ...options, capabilities: ["mail", "smime"] });
  return client.api.Email.get({ properties: ["subject", "smimeStatus"] });
}
export function custom(): unknown {
  const client = new JsonMetaClient({ ...options, capabilities: [notes] });
  return client.api.Note.get({ ids: [] });
}

export function rfcHelpers(): unknown {
  const client = new JsonMetaClient({ ...options, capabilities: [bookmarks] });
  return client.api.Bookmark.get({ properties: ["url"] }).then(({ list }) => list[0]?.url);
}
export function jsContactNamespace(card: JSContact.Card): string | undefined {
  return card.name?.full;
}

const session = {
  capabilities: {
    "urn:ietf:params:jmap:core": { maxCallsInRequest: 16, maxSizeRequest: 10_000_000 },
  },
  accounts: { a1: { name: "a", isPersonal: true, isReadOnly: false, accountCapabilities: {} } },
  primaryAccounts: { "urn:ietf:params:jmap:core": "a1" },
  username: "user",
  apiUrl: "https://jmap.test/api",
  downloadUrl: "https://jmap.test/download",
  uploadUrl: "https://jmap.test/upload",
  eventSourceUrl: "https://jmap.test/events",
  state: "state",
};

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = new Request(input, init);
  if (request.url === options.sessionUrl) return Response.json(session);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const body = (await request.json()) as { methodCalls: [string, object, string][] };
  return Response.json({ sessionState: "state", methodResponses: body.methodCalls });
};

const client = new JsonMetaClient({ ...options, capabilities: [] });
console.log(JSON.stringify(await client.api.Core.echo({ hello: "world" })));
