// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import nock from "nock";

import { BUILT_IN_CAPABILITIES } from "../built-ins.ts";
import { core } from "../capabilities/core.ts";
import type { CoreSessionCapabilities } from "../capabilities/core.ts";
import type { Response as JmapResponse, Session } from "../rfc-types/core/index.ts";

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
  Object.values(BUILT_IN_CAPABILITIES).map((c) => [c.urn, {}]),
);
const primaryAccounts = Object.fromEntries(
  Object.values(BUILT_IN_CAPABILITIES).map((c) => [c.urn, accountId]),
);
export const coreSessionCapabilities: CoreSessionCapabilities = {
  maxSizeUpload: 50_000_000,
  maxConcurrentUpload: 4,
  maxSizeRequest: 10_000_000,
  maxConcurrentRequests: 4,
  maxCallsInRequest: 16,
  maxObjectsInGet: 256,
  maxObjectsInSet: 128,
  collationAlgorithms: [],
};

const capabilities = {
  ...Object.fromEntries(Object.values(BUILT_IN_CAPABILITIES).map((c) => [c.urn, {}])),
  [core.urn]: coreSessionCapabilities,
};

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
