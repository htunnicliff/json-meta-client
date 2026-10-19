// oxlint-disable typescript/no-unsafe-type-assertion
import type { Response as JmapResponse, Session } from "jmap-rfc-types";
import nock from "nock";

import * as builtInCapabilities from "../capabilities/index.ts";

export const host = "https://example.test";

export const sessionUrl: string = `${host}/.well-known/jmap`;
export const apiUrl: string = `${host}/special-jmap-api`;
export const uploadUrl: string = `${host}/upload/{accountId}`;
export const downloadUrl: string = `${host}/download/{accountId}/{blobId}?type={type}&name={name}`;
export const eventSourceUrl: string = `${host}/events?types={types}&closeafter={closeafter}&ping={ping}`;

export const bearerToken = "<opaque-token>";
export const accountId = "<primary-account-id>";
export const username = "<username>";

export const sessionState = "<opaque-session-state>";

const accountCapabilities = Object.fromEntries(
  Object.values(builtInCapabilities).map((c) => [c.urn, {}]),
);
const primaryAccounts = Object.fromEntries(
  Object.values(builtInCapabilities).map((c) => [c.urn, accountId]),
);
const capabilities = Object.fromEntries(Object.values(builtInCapabilities).map((c) => [c.urn, {}]));

export function makeSession(): Session {
  return {
    accounts: {
      [accountId]: {
        name: "Primary",
        isPersonal: true,
        isReadOnly: false,
        accountCapabilities: accountCapabilities,
      },
    },
    apiUrl,
    downloadUrl,
    uploadUrl,
    eventSourceUrl,
    state: sessionState,
    primaryAccounts,
    username,
    capabilities,
  };
}

export function mockSession(): nock.Scope {
  return nock(host).get(new URL(sessionUrl).pathname).reply(200, makeSession());
}

export function mockApi(
  response: JmapResponse,
  apiUrlPath: string = new URL(apiUrl).pathname,
): nock.Scope {
  return nock(host, {
    reqheaders: {
      authorization: `Bearer ${bearerToken}`,
      accept: "application/json",
      "content-type": "application/json",
    },
  })
    .post(apiUrlPath)
    .reply(200, response);
}
