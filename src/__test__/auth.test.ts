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
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfigurationError, NetworkError } from "../errors.ts";
import type { OnStateChangeHandler } from "../index.ts";
import { JsonMetaClient } from "../index.ts";
import { accountId, host, makeSession, sessionUrl, sessionState } from "./fixtures.ts";

afterEach(() => nock.cleanAll());

describe("authentication", () => {
  // cspell:ignore dXNlcjpwYXNz dXNlcjo üser päss
  it.each([
    { auth: { username: "user", password: "pass" }, authorization: "Basic dXNlcjpwYXNz" },
    { auth: { username: "user", password: "" }, authorization: "Basic dXNlcjo=" },
    {
      auth: { username: "üser", password: "päss:word" },
      authorization: "Basic w7xzZXI6cMOkc3M6d29yZA==",
    },
    { auth: "token", authorization: "Bearer token" },
  ])("authenticates every transport with $authorization", async ({ auth, authorization }) => {
    const scope = nock(host, {
      reqheaders: { authorization },
    })
      .get(new URL(sessionUrl).pathname)
      .reply(200, makeSession())
      .post("/special-jmap-api")
      .reply(200, { sessionState, methodResponses: [["Core/echo", { ok: true }, "echo"]] })
      .post(`/upload/${encodeURIComponent(accountId)}`)
      .reply(200, { blobId: "blob" })
      .get(`/download/${encodeURIComponent(accountId)}/blob`)
      .query(true)
      .reply(200, "download")
      .get("/events")
      .query(true)
      .reply(
        200,
        'data: {"@type":"StateChange","changed":{"account":{"Email":"authenticated"}}}\n\n',
        { "content-type": "text/event-stream" },
      );
    const client = new JsonMetaClient({
      sessionUrl,
      capabilities: [],
      auth,
    });
    await expect(client.session).resolves.toEqual(makeSession());
    await expect(client.api.Core.echo({}, { id: "echo" })).resolves.toEqual({ ok: true });
    await client.blob.upload("upload", { accountId });
    await client.blob.download({ accountId, blobId: "blob", type: "text/plain", name: "file" });
    const controller = new AbortController();
    const handler = vi.fn<OnStateChangeHandler>();
    const subscription = await client.onStateChange(
      (...args) => {
        handler(...args);
        controller.abort();
      },
      { signal: controller.signal },
    );
    try {
      await vi.waitFor(() =>
        expect(handler).toHaveBeenCalledWith(
          null,
          expect.objectContaining({ state: "authenticated" }),
        ),
      );
      expect(scope.isDone()).toBe(true);
    } finally {
      controller.abort();
      subscription[Symbol.dispose]();
    }
  });
  it("awaits custom auth on the outgoing request before hooks for every HTTP path", async () => {
    const requests: Request[] = [];
    const observed: Request[] = [];
    let signedBody: unknown;
    const scope = nock(host, {
      reqheaders: {
        authorization: "Custom signed",
        "x-auth-url": (value) => String(value).startsWith(host),
        "x-proxy-auth": "proxy-secret",
        "x-hook": "after-auth",
      },
    })
      .get(new URL(sessionUrl).pathname)
      .reply(200, makeSession())
      .post("/special-jmap-api", {
        using: ["urn:ietf:params:jmap:core"],
        methodCalls: [["Core/echo", { hello: "world", accountId }, "0"]],
      })
      .reply(200, { sessionState, methodResponses: [["Core/echo", { hello: "world" }, "0"]] })
      .post(`/upload/${encodeURIComponent(accountId)}`, "upload")
      .reply(200, { blobId: "blob" })
      .get(`/download/${encodeURIComponent(accountId)}/blob`)
      .query({ type: "text/plain", name: "file" })
      .reply(200, "download");
    const client = new JsonMetaClient({
      sessionUrl,
      capabilities: ["mail"],
      auth: async ({ request }) => {
        requests.push(request);
        await new Promise((resolve) => setTimeout(resolve, 1));
        request.headers.set("authorization", "Custom signed");
        request.headers.set("x-auth-url", request.url);
        request.headers.set("x-proxy-auth", "proxy-secret");
        if (request.method === "POST" && request.url.endsWith("special-jmap-api")) {
          signedBody = await request.clone().json();
        }
      },
      hooks: {
        beforeFetch: [
          ({ request }) => {
            expect(request.headers.get("authorization")).toBe("Custom signed");
            observed.push(request);
            request.headers.set("x-hook", "after-auth");
            return request;
          },
        ],
      },
    });
    await client.session;
    await expect(client.api.Core.echo({ hello: "world" }, { id: "0" })).resolves.toEqual({
      hello: "world",
    });
    await client.blob.upload("upload");
    expect(
      await (
        await client.blob.download({ blobId: "blob", type: "text/plain", name: "file" })
      ).text(),
    ).toBe("download");
    expect(scope.isDone()).toBe(true);
    expect(signedBody).toMatchObject({ methodCalls: [["Core/echo", { hello: "world" }, "0"]] });
    expect(requests).toHaveLength(4);
    expect(observed.every((request, i) => request === requests[i])).toBe(true);
  });
  it("authenticates again on real event-stream reconnects and preserves request mutations", async () => {
    nock(host).get(new URL(sessionUrl).pathname).reply(200, makeSession());
    let connection = 0;
    const hookCredentials: (string | null)[] = [];
    const scope = nock(host, {
      reqheaders: {
        accept: "text/event-stream",
        authorization: "Custom stream-1",
        "x-proxy-auth": "stream-proxy",
        "x-stream-hook": "after-auth",
      },
    })
      .get("/events")
      .query(true)
      .reply(
        200,
        'retry: 1\nid: first-event\ndata: {"@type":"StateChange","changed":{"account":{"Email":"first"}}}\n\n',
        { "content-type": "text/event-stream" },
      );
    const reconnect = nock(host, {
      reqheaders: {
        accept: "text/event-stream",
        authorization: "Custom stream-2",
        "last-event-id": "first-event",
        "x-proxy-auth": "stream-proxy",
        "x-stream-hook": "after-auth",
      },
    })
      .get("/events")
      .query(true)
      .reply(200, 'data: {"@type":"StateChange","changed":{"account":{"Email":"second"}}}\n\n', {
        "content-type": "text/event-stream",
      });
    const controller = new AbortController();
    const handler = vi.fn<OnStateChangeHandler>();
    const client = new JsonMetaClient({
      sessionUrl,
      capabilities: [],
      auth: async ({ request }) => {
        if (new URL(request.url).pathname !== "/events") return;
        const current = ++connection;
        await new Promise((resolve) => setTimeout(resolve, 1));
        request.headers.set("authorization", `Custom stream-${current}`);
        request.headers.set("x-proxy-auth", "stream-proxy");
      },
      hooks: {
        beforeFetch: [
          ({ request }) => {
            if (new URL(request.url).pathname === "/events") {
              hookCredentials.push(request.headers.get("authorization"));
              return new Request(request, {
                headers: new Headers([...request.headers, ["x-stream-hook", "after-auth"]]),
              });
            }
            return request;
          },
        ],
      },
    });
    const subscription = await client.onStateChange(
      (...args) => {
        handler(...args);
        if (args[1]?.state === "second") controller.abort();
      },
      { signal: controller.signal },
    );
    try {
      await vi.waitFor(() =>
        expect(handler).toHaveBeenCalledWith(null, expect.objectContaining({ state: "second" })),
      );
      expect(scope.isDone()).toBe(true);
      expect(reconnect.isDone()).toBe(true);
      expect(connection).toBe(2);
      expect(hookCredentials).toEqual(["Custom stream-1", "Custom stream-2"]);
    } finally {
      controller.abort();
      subscription[Symbol.dispose]();
    }
  });

  it.each([
    undefined,
    null,
    "",
    "  ",
    42,
    [],
    {},
    { username: "user" },
    { password: "pass" },
    { username: "", password: "pass" },
    { username: "  ", password: "pass" },
    { username: "user:name", password: "pass" },
    { username: 42, password: "pass" },
    { username: "user", password: null },
    { username: "user", password: 42 },
  ])("rejects invalid credentials during construction: %j", (auth) => {
    expect(
      () =>
        new JsonMetaClient({
          sessionUrl,
          capabilities: [],
          // @ts-expect-error - Runtime validation of invalid credentials.
          auth,
        }),
    ).toThrow(ConfigurationError);
  });

  it("rejects the removed bearerToken configuration", () => {
    const oldOptions = { sessionUrl, capabilities: [], bearerToken: "token" };
    // @ts-expect-error - The old configuration no longer supplies authentication.
    expect(() => new JsonMetaClient(oldOptions)).toThrow(ConfigurationError);
  });

  it("does not send requests when the custom callback rejects", async () => {
    const failure = new Error("Credential lookup failed");
    const scope = nock(host).get(new URL(sessionUrl).pathname).reply(200, makeSession());
    const client = new JsonMetaClient({
      sessionUrl,
      capabilities: [],
      auth: async () => {
        throw failure;
      },
    });
    await expect(client.session).rejects.toMatchObject({ name: NetworkError.name, cause: failure });
    expect(scope.isDone()).toBe(false);
  });

  it("resolves current credentials again when refreshing the session", async () => {
    const scope = nock(host, { reqheaders: { authorization: "Bearer first" } })
      .get(new URL(sessionUrl).pathname)
      .reply(200, makeSession());
    const refreshed = nock(host, { reqheaders: { authorization: "Bearer second" } })
      .get(new URL(sessionUrl).pathname)
      .reply(200, makeSession());
    let token = "first";
    const client = new JsonMetaClient({
      sessionUrl,
      capabilities: [],
      auth: ({ request }) => {
        request.headers.set("authorization", `Bearer ${token}`);
      },
    });
    await client.session;
    token = "second";
    await client.refreshSession();
    expect(scope.isDone()).toBe(true);
    expect(refreshed.isDone()).toBe(true);
  });
});
