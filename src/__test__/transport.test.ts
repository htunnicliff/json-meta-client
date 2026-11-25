// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { JsonMetaClient } from "../client.ts";
import { CancellationError, ConfigurationError, HttpError, NetworkError } from "../errors/index.ts";
import type { Request as JmapRequest, Response as JmapResponse } from "../rfc-types/core/index.ts";
import { httpTransport } from "../transports/http.ts";
import type { Transport, TransportContext, TransportFactory } from "../transports/types.ts";
import type { AfterFetchHook, BeforeFetchHook } from "../types.ts";
import { apiUrl, makeSession, sessionUrl } from "./fixtures.ts";

function echo(request: JmapRequest): JmapResponse {
  return {
    methodResponses: request.methodCalls.map(([method, , id]) => [method, { id }, id]),
    sessionState: "state",
  };
}

/** A factory whose transports answer in memory, recording what they get */
function fakeTransport() {
  const contexts: TransportContext[] = [];
  const sends: Mock<Transport["send"]>[] = [];
  const disposes: Mock<() => void>[] = [];
  const factory = vi.fn<TransportFactory>((context) => {
    contexts.push(context);
    const send = vi.fn<Transport["send"]>(async (request) => echo(request));
    const dispose = vi.fn<() => void>();
    sends.push(send);
    disposes.push(dispose);
    return { send, [Symbol.dispose]: dispose };
  });
  return { factory, contexts, sends, disposes };
}

function stubSession() {
  const fetchMock = vi.fn<typeof fetch>(async () => Response.json(makeSession()));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("transport option", () => {
  it("calls the factory once per client, and every batch uses its transport", async () => {
    stubSession();
    const { factory, sends } = fakeTransport();
    const client = new JsonMetaClient({
      sessionUrl,
      auth: "token",
      capabilities: [],
      transport: factory,
    });

    await client.api.Core.echo({}, { id: "a" });
    await client.isolated((api) => api.Core.echo({}, { id: "b" }));

    expect(factory).toHaveBeenCalledOnce();
    expect(sends[0]!).toHaveBeenCalledTimes(2);
  });

  it("gives two clients two transports", () => {
    const { factory } = fakeTransport();
    const a = new JsonMetaClient({ sessionUrl, auth: "a", capabilities: [], transport: factory });
    const b = new JsonMetaClient({ sessionUrl, auth: "b", capabilities: [], transport: factory });

    expect(factory).toHaveBeenCalledTimes(2);
    expect(factory.mock.results[0]!.value).not.toBe(factory.mock.results[1]!.value);
    a[Symbol.dispose]();
    b[Symbol.dispose]();
  });

  it("defaults to HTTP", async () => {
    const fetchMock = stubSession();
    fetchMock.mockImplementationOnce(async () => Response.json(makeSession()));
    fetchMock.mockImplementationOnce(async (input) => {
      if (!(input instanceof Request)) throw new Error("Expected a Request");
      return Response.json(echo(await input.json()));
    });
    const client = new JsonMetaClient({ sessionUrl, auth: "token", capabilities: [] });

    await expect(client.api.Core.echo({}, { id: "a" })).resolves.toEqual({ id: "a" });
    const request = fetchMock.mock.calls[1]![0];
    if (!(request instanceof Request)) throw new Error("Expected a Request");
    expect(request.url).toBe(apiUrl);
    expect(request.method).toBe("POST");
    expect(request.headers.get("content-type")).toBe("application/json");
    expect(request.headers.get("accept")).toBe("application/json");
  });

  it.each([{}, "websocket", null])("rejects a transport that isn't a factory: %j", (transport) => {
    expect(
      () =>
        new JsonMetaClient({
          sessionUrl,
          auth: "token",
          capabilities: [],
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          transport: transport as unknown as TransportFactory,
        }),
    ).toThrow(ConfigurationError);
  });
});

describe("transport context", () => {
  it("fetch applies auth, runs the fetch hooks, and rejects with HttpError", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("nope", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const beforeFetch = vi.fn<BeforeFetchHook>(({ httpRequest }) => httpRequest);
    const afterFetch = vi.fn<AfterFetchHook>(({ httpResponse }) => httpResponse);
    const { factory, contexts } = fakeTransport();
    using _ = new JsonMetaClient({
      sessionUrl,
      auth: "token",
      capabilities: [],
      hooks: { beforeFetch: [beforeFetch], afterFetch: [afterFetch] },
      transport: factory,
    });

    await expect(contexts[0]!.fetch(apiUrl, { method: "POST" })).rejects.toBeInstanceOf(HttpError);
    const request = fetchMock.mock.calls[0]![0];
    if (!(request instanceof Request)) throw new Error("Expected a Request");
    expect(request.headers.get("authorization")).toBe("Bearer token");
    expect(beforeFetch).toHaveBeenCalledOnce();
    expect(afterFetch).toHaveBeenCalledOnce();
  });

  it("fetch rejects with NetworkError when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const { factory, contexts } = fakeTransport();
    using _ = new JsonMetaClient({
      sessionUrl,
      auth: "token",
      capabilities: [],
      transport: factory,
    });

    await expect(contexts[0]!.fetch(apiUrl)).rejects.toBeInstanceOf(NetworkError);
  });

  it("authenticate applies auth to a copy without running hooks", async () => {
    const beforeFetch = vi.fn<BeforeFetchHook>(({ httpRequest }) => httpRequest);
    const { factory, contexts } = fakeTransport();
    using _ = new JsonMetaClient({
      sessionUrl,
      auth: { username: "user", password: "pass" },
      capabilities: [],
      hooks: { beforeFetch: [beforeFetch] },
      transport: factory,
    });
    const original = new Request("wss://example.test/ws");

    const authenticated = await contexts[0]!.authenticate(original);

    expect(authenticated.headers.get("authorization")).toBe(`Basic ${btoa("user:pass")}`);
    expect(original.headers.has("authorization")).toBe(false);
    expect(beforeFetch).not.toHaveBeenCalled();
  });
});

describe("client[Symbol.dispose]", () => {
  it("aborts the signal passed to send, disposes the transport, and rejects later calls", async () => {
    stubSession();
    const sending = Promise.withResolvers<void>();
    let signal: AbortSignal | undefined;
    const dispose = vi.fn<() => void>();
    const client = new JsonMetaClient({
      sessionUrl,
      auth: "token",
      capabilities: [],
      transport: () => ({
        send: (_, options) => {
          signal = options.signal;
          sending.resolve();
          return new Promise((_, reject) =>
            options.signal.addEventListener("abort", () =>
              reject(new CancellationError("Aborted")),
            ),
          );
        },
        [Symbol.dispose]: dispose,
      }),
    });

    const pending = client.api.Core.echo({});
    await sending.promise;
    client[Symbol.dispose]();

    await expect(pending).rejects.toBeInstanceOf(CancellationError);
    expect(signal?.aborted).toBe(true);
    expect(dispose).toHaveBeenCalledOnce();
    await expect(client.api.Core.echo({})).rejects.toBeInstanceOf(CancellationError);
  });

  it("rejects an HTTP batch in flight with CancellationError", async () => {
    const fetching = Promise.withResolvers<void>();
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json(makeSession()))
        .mockImplementationOnce(async (input) => {
          if (!(input instanceof Request)) throw new Error("Expected a Request");
          fetching.resolve();
          return new Promise((_, reject) =>
            input.signal.addEventListener("abort", () => reject(input.signal.reason)),
          );
        }),
    );
    const client = new JsonMetaClient({
      sessionUrl,
      auth: "token",
      capabilities: [],
      transport: httpTransport(),
    });

    const pending = client.api.Core.echo({});
    await fetching.promise;
    client[Symbol.dispose]();

    await expect(pending).rejects.toBeInstanceOf(CancellationError);
  });

  it("rejects method calls still waiting in a batch", async () => {
    const { factory, sends } = fakeTransport();
    const client = new JsonMetaClient({
      sessionUrl,
      auth: "t",
      capabilities: [],
      transport: factory,
    });

    const pending = client.api.Core.echo({});
    client[Symbol.dispose]();

    await expect(pending).rejects.toBeInstanceOf(CancellationError);
    expect(sends[0]!).not.toHaveBeenCalled();
  });

  it("can be called more than once", () => {
    const { factory, disposes } = fakeTransport();
    const client = new JsonMetaClient({
      sessionUrl,
      auth: "t",
      capabilities: [],
      transport: factory,
    });

    client[Symbol.dispose]();
    client[Symbol.dispose]();

    expect(disposes[0]!).toHaveBeenCalledOnce();
  });

  it("works with using", () => {
    const { factory, disposes } = fakeTransport();
    {
      using _ = new JsonMetaClient({
        sessionUrl,
        auth: "t",
        capabilities: [],
        transport: factory,
      });
    }
    expect(disposes[0]!).toHaveBeenCalledOnce();
  });
});

function sendOverHttp(response: Response) {
  const context: TransportContext = {
    authenticate: async (request) => request,
    fetch: async () => response,
  };
  return httpTransport()(context).send(
    { using: [], methodCalls: [] },
    {
      session: makeSession(),
      signal: new AbortController().signal,
    },
  );
}
function setupClient() {
  const fetchMock = stubSession();
  const { factory } = fakeTransport();
  const client = new JsonMetaClient({
    sessionUrl,
    auth: "t",
    capabilities: [],
    transport: factory,
  });
  return { client, fetchMock };
}
function pushClient() {
  stubSession();
  const opened = Promise.withResolvers<void>();
  const closeChannel = vi.fn<() => void>();
  const subscribe = vi.fn<NonNullable<Transport["subscribe"]>>(async () => {
    await opened.promise;
    return { [Symbol.dispose]: closeChannel };
  });
  const client = new JsonMetaClient({
    sessionUrl,
    auth: "t",
    capabilities: [],
    transport: () => ({ send: async (request) => echo(request), subscribe }),
  });
  return { client, opened, closeChannel, subscribe };
}
describe(httpTransport, () => {
  it("keeps the request on the NetworkError when the body can't be read", async () => {
    const cause = new TypeError("Body stream disconnected");
    const body = new ReadableStream({ start: (controller) => controller.error(cause) });

    const error = await sendOverHttp(new Response(body)).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(NetworkError);
    expect(error).toMatchObject({
      message: "Failed to read",
      cause,
      request: expect.objectContaining({ method: "POST", url: apiUrl }),
    });
  });

  it("rejects a body that isn't JSON with a NetworkError that says so", async () => {
    const error = await sendOverHttp(new Response("{invalid")).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(NetworkError);
    expect(error).toMatchObject({
      message: "The server's JMAP Response is not valid JSON",
      cause: expect.any(SyntaxError),
      request: expect.objectContaining({ method: "POST", url: apiUrl }),
    });
  });
});

describe("client disposal beyond method calls", () => {
  it("rejects blob transfers and session refreshes after dispose", async () => {
    const { client, fetchMock } = setupClient();
    await client.session;
    const calls = fetchMock.mock.calls.length;

    client[Symbol.dispose]();

    await expect(client.refreshSession()).rejects.toBeInstanceOf(CancellationError);
    await expect(client.blob.upload("data", { accountId: "account" })).rejects.toBeInstanceOf(
      CancellationError,
    );
    await expect(
      client.blob.download({ accountId: "account", blobId: "b", name: "n", type: "text/plain" }),
    ).rejects.toBeInstanceOf(CancellationError);
    expect(fetchMock).toHaveBeenCalledTimes(calls);
  });

  it("rejects a blob upload in flight with CancellationError", async () => {
    const { client, fetchMock } = setupClient();
    await client.session;
    const fetching = Promise.withResolvers<void>();
    fetchMock.mockImplementationOnce(async (input) => {
      if (!(input instanceof Request)) throw new Error("Expected a Request");
      fetching.resolve();
      return new Promise((_, reject) =>
        input.signal.addEventListener("abort", () => reject(input.signal.reason)),
      );
    });

    const upload = client.blob.upload("data", { accountId: "account" });
    await fetching.promise;
    client[Symbol.dispose]();

    await expect(upload).rejects.toBeInstanceOf(CancellationError);
  });
});

describe("onStateChange with a transport's push channel", () => {
  it("waits for the transport's subscribe promise", async () => {
    const { client, opened, subscribe } = pushClient();
    let settled = false;

    const subscription = client
      .onStateChange(() => {})
      .then((value) => {
        settled = true;
        return value;
      });
    await vi.waitFor(() => expect(subscribe).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(settled).toBe(false);

    opened.resolve();
    await subscription;
    expect(settled).toBe(true);
    client[Symbol.dispose]();
  });

  it("ends the subscription when its signal aborts while the channel opens", async () => {
    const { client, opened, closeChannel, subscribe } = pushClient();
    const controller = new AbortController();

    const subscription = client.onStateChange(() => {}, { signal: controller.signal });
    await vi.waitFor(() => expect(subscribe).toHaveBeenCalledOnce());
    controller.abort();
    opened.resolve();
    await subscription;

    await vi.waitFor(() => expect(closeChannel).toHaveBeenCalledOnce());
    client[Symbol.dispose]();
  });
});
