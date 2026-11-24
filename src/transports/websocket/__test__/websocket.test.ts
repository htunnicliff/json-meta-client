// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { AddressInfo } from "node:net";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import type { WebSocket as ServerSocket } from "ws";

import { makeSession } from "../../../__test__/fixtures.ts";
import { JsonMetaClient } from "../../../client.ts";
import {
  CancellationError,
  ConfigurationError,
  JmapError,
  NetworkError,
  StateChangeError,
} from "../../../errors/index.ts";
import type {
  Request as JmapRequest,
  Session,
  StateChange,
  WebSocketRequest,
} from "../../../rfc-types/core/index.ts";
import type {
  AfterJmapResponseHook,
  BeforeJmapRequestHook,
  OnStateChangeHandler,
} from "../../../types.ts";
import type { PushEvents, Transport, TransportContext } from "../../types.ts";
import { webSocketTransport } from "../index.ts";
import type { WebSocketTransportOptions } from "../index.ts";

/**
 * A local JMAP WebSocket server that records what clients send and lets each
 * test answer by hand
 */
class TestServer {
  static async start(): Promise<TestServer> {
    const server = new TestServer();
    await new Promise<void>((resolve) => server.wss.once("listening", resolve));
    return server;
  }

  readonly wss = new WebSocketServer({
    port: 0,
    host: "127.0.0.1",
    handleProtocols: () => (this.protocol === null ? false : this.protocol),
  });

  /** The subprotocol to select, or `null` to select none */
  protocol: string | null = "jmap";

  readonly sockets: ServerSocket[] = [];
  readonly headers: Record<string, string | string[] | undefined>[] = [];
  readonly messages: Record<string, unknown>[] = [];
  #waiters: (() => void)[] = [];

  constructor() {
    this.wss.on("connection", (socket, request) => {
      this.sockets.push(socket);
      this.headers.push(request.headers);
      socket.on("message", (data) => {
        const bytes = Array.isArray(data)
          ? Buffer.concat(data)
          : data instanceof ArrayBuffer
            ? new Uint8Array(data)
            : data;
        this.messages.push(JSON.parse(new TextDecoder().decode(bytes)));
        for (const wake of this.#waiters.splice(0)) wake();
      });
    });
  }

  url(path = "/jmap"): string {
    const address: string | AddressInfo | null = this.wss.address();
    if (typeof address !== "object" || !address) throw new Error("Expected a port");
    const { port } = address;
    return `ws://127.0.0.1:${port}${path}`;
  }

  /** Wait until the server has received this many messages */
  async received(count: number): Promise<Record<string, unknown>[]> {
    while (this.messages.length < count) {
      // oxlint-disable-next-line no-await-in-loop
      await new Promise<void>((resolve) => this.#waiters.push(resolve));
    }
    return this.messages;
  }

  /** The requests received so far */
  requests(): WebSocketRequest[] {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return this.messages.filter((m) => m["@type"] === "Request") as unknown as WebSocketRequest[];
  }

  /** Answer a request by echoing its method calls */
  respond(request: WebSocketRequest, socket = this.sockets.at(-1)!): void {
    socket.send(
      JSON.stringify({
        "@type": "Response",
        requestId: request.id,
        methodResponses: request.methodCalls.map(([method, , id]) => [method, { id }, id]),
        sessionState: "state",
      }),
    );
  }

  async close(): Promise<void> {
    for (const socket of this.wss.clients) socket.terminate();
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
  }
}

let server: TestServer;

beforeEach(async () => {
  server = await TestServer.start();
});

afterEach(async () => {
  vi.useRealTimers();
  await server.close();
});

const createWebSocket: WebSocketTransportOptions["createWebSocket"] = (url, protocols, headers) =>
  new WebSocket(url, protocols, { headers });

function sessionWith(url: string, supportsPush = false): Session {
  const session = makeSession();
  return {
    ...session,
    capabilities: {
      ...session.capabilities,
      "urn:ietf:params:jmap:websocket": { url, supportsPush },
    },
  };
}

const context: TransportContext = {
  authenticate: async (request) => {
    const copy = request.clone();
    copy.headers.set("authorization", "Bearer token");
    return copy;
  },
  fetch: async () => {
    throw new Error("Unexpected fetch");
  },
};

function request(id: string): JmapRequest {
  return { using: ["urn:ietf:params:jmap:core"], methodCalls: [["Core/echo", {}, id]] };
}

function setup(options: WebSocketTransportOptions = {}) {
  const controller = new AbortController();
  const transport: Transport = webSocketTransport({ createWebSocket, ...options })(context);
  const send = (jmapRequest: JmapRequest, session = sessionWith(server.url())) =>
    transport.send(jmapRequest, { session, signal: controller.signal });
  return { transport, controller, send };
}

describe(webSocketTransport, () => {
  it("sends each request with an id and settles it from the response", async () => {
    const { transport, send } = setup();

    const response = send(request("a"));
    const [message] = await server.received(1);
    expect(message).toEqual({ "@type": "Request", id: expect.any(String), ...request("a") });
    server.respond(server.requests()[0]!);

    await expect(response).resolves.toEqual({
      methodResponses: [["Core/echo", { id: "a" }, "a"]],
      sessionState: "state",
    });
    transport[Symbol.dispose]?.();
  });

  it("selects the jmap subprotocol and passes the auth headers to createWebSocket", async () => {
    const create =
      vi.fn<NonNullable<WebSocketTransportOptions["createWebSocket"]>>(createWebSocket);
    const { transport, send } = setup({ createWebSocket: create });

    const response = send(request("a"));
    await server.received(1);
    server.respond(server.requests()[0]!);
    await response;

    expect(create).toHaveBeenCalledExactlyOnceWith(server.url(), ["jmap"], {
      authorization: "Bearer token",
    });
    expect(server.headers[0]).toMatchObject({ authorization: "Bearer token" });
    transport[Symbol.dispose]?.();
  });

  it("shares one socket between requests made while it connects", async () => {
    const { transport, send } = setup();

    const responses = [send(request("a")), send(request("b")), send(request("c"))];
    await server.received(3);
    for (const message of server.requests()) server.respond(message);

    await expect(Promise.all(responses)).resolves.toHaveLength(3);
    expect(server.sockets).toHaveLength(1);
    transport[Symbol.dispose]?.();
  });

  it("settles out-of-order responses by requestId", async () => {
    const { transport, send } = setup();

    const a = send(request("a"));
    const b = send(request("b"));
    await server.received(2);
    const [first, second] = server.requests();
    server.respond(second!);
    await expect(b).resolves.toMatchObject({ methodResponses: [["Core/echo", { id: "b" }, "b"]] });
    server.respond(first!);
    await expect(a).resolves.toMatchObject({ methodResponses: [["Core/echo", { id: "a" }, "a"]] });
    transport[Symbol.dispose]?.();
  });

  it("rejects only the request a RequestError names", async () => {
    const { transport, send } = setup();

    const a = send(request("a"));
    const b = send(request("b"));
    await server.received(2);
    const [first, second] = server.requests();
    server.sockets[0]!.send(
      JSON.stringify({
        "@type": "RequestError",
        requestId: first!.id,
        type: "urn:ietf:params:jmap:error:limit",
        limit: "maxSizeRequest",
        status: 400,
        detail: "Too big",
      }),
    );
    server.respond(second!);

    const error = await a.catch((error: unknown) => error);
    expect(error).toBeInstanceOf(JmapError);
    expect(error).toMatchObject({
      type: "urn:ietf:params:jmap:error:limit",
      limit: "maxSizeRequest",
      status: 400,
      detail: "Too big",
    });
    await expect(b).resolves.toMatchObject({ sessionState: "state" });
    transport[Symbol.dispose]?.();
  });

  it("rejects in-flight requests with NetworkError when the socket closes, then reconnects", async () => {
    const { transport, send } = setup();

    const a = send(request("a"));
    await server.received(1);
    server.sockets[0]!.close(1011, "Server error");
    await expect(a).rejects.toBeInstanceOf(NetworkError);
    expect(server.messages).toHaveLength(1);

    const b = send(request("b"));
    await server.received(2);
    server.respond(server.requests()[1]!);
    await expect(b).resolves.toMatchObject({ sessionState: "state" });
    expect(server.sockets).toHaveLength(2);
    transport[Symbol.dispose]?.();
  });

  it("rejects with ConfigurationError when the session doesn't advertise the WebSocket capability", async () => {
    const { send } = setup();

    await expect(send(request("a"), makeSession())).rejects.toBeInstanceOf(ConfigurationError);
    expect(server.sockets).toHaveLength(0);
  });

  it("fails the connection when the server doesn't select the jmap subprotocol", async () => {
    server.protocol = null;
    const { send } = setup();

    const error = await send(request("a")).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(NetworkError);
  });

  it("closes the socket after idleSeconds with nothing pending", async () => {
    const { transport, send } = setup({ idleSeconds: 0.05 });

    const a = send(request("a"));
    await server.received(1);
    server.respond(server.requests()[0]!);
    await a;
    const socket = server.sockets[0]!;
    await vi.waitFor(() => expect(socket.readyState).toBe(WebSocket.CLOSED));

    const b = send(request("b"));
    await server.received(2);
    server.respond(server.requests()[1]!);
    await b;
    expect(server.sockets).toHaveLength(2);
    transport[Symbol.dispose]?.();
  });

  it("reconnects when a refreshed session's WebSocket URL changes", async () => {
    const { transport, send } = setup();

    const a = send(request("a"), sessionWith(server.url("/one")));
    await server.received(1);
    const b = send(request("b"), sessionWith(server.url("/two")));
    await server.received(2);
    expect(server.sockets).toHaveLength(2);

    // The first socket settles what it has, then closes
    server.respond(server.requests()[0]!, server.sockets[0]);
    server.respond(server.requests()[1]!, server.sockets[1]);
    await Promise.all([a, b]);
    await vi.waitFor(() => expect(server.sockets[0]!.readyState).toBe(WebSocket.CLOSED));
    expect(server.sockets[1]!.readyState).toBe(WebSocket.OPEN);
    transport[Symbol.dispose]?.();
  });

  it("rejects pending requests with CancellationError when the signal aborts", async () => {
    const { send, controller } = setup();

    const a = send(request("a"));
    await server.received(1);
    controller.abort();

    await expect(a).rejects.toBeInstanceOf(CancellationError);
    await expect(send(request("b"))).rejects.toBeInstanceOf(CancellationError);
  });

  it("rejects pending requests with CancellationError when disposed", async () => {
    const { send, transport } = setup();

    const a = send(request("a"));
    await server.received(1);
    transport[Symbol.dispose]?.();

    await expect(a).rejects.toBeInstanceOf(CancellationError);
  });
});

function events(): PushEvents & {
  onStateChange: ReturnType<typeof vi.fn<PushEvents["onStateChange"]>>;
  onError: ReturnType<typeof vi.fn<PushEvents["onError"]>>;
} {
  return {
    onStateChange: vi.fn<PushEvents["onStateChange"]>(),
    onError: vi.fn<PushEvents["onError"]>(),
  };
}
function stateChange(state: string, pushState?: string): StateChange & { pushState?: string } {
  return {
    "@type": "StateChange",
    changed: { account: { Email: state } },
    ...(pushState ? { pushState } : {}),
  };
}
describe("webSocketTransport push", () => {
  it("returns null when the session doesn't support push", () => {
    const { transport } = setup();

    expect(transport.subscribe?.(sessionWith(server.url(), false), events())).toBeNull();
    expect(transport.subscribe?.(makeSession(), events())).toBeNull();
  });

  it("enables push for every data type and delivers state changes", async () => {
    const { transport } = setup();
    const push = events();

    const subscription = transport.subscribe?.(sessionWith(server.url(), true), push);
    expect(subscription).not.toBeNull();
    const [message] = await server.received(1);
    expect(message).toEqual({ "@type": "WebSocketPushEnable", dataTypes: null });

    server.sockets[0]!.send(JSON.stringify(stateChange("s1", "p1")));
    await vi.waitFor(() =>
      expect(push.onStateChange).toHaveBeenCalledWith(stateChange("s1", "p1")),
    );
    transport[Symbol.dispose]?.();
  });

  it("sends requests on the push socket", async () => {
    const { transport, send } = setup();
    transport.subscribe?.(sessionWith(server.url(), true), events());
    await server.received(1);

    const a = send(request("a"), sessionWith(server.url(), true));
    await server.received(2);
    server.respond(server.requests()[0]!);
    await a;

    expect(server.sockets).toHaveLength(1);
    transport[Symbol.dispose]?.();
  });

  it("keeps the socket open past idleSeconds while subscribed", async () => {
    const { transport } = setup({ idleSeconds: 0.02 });
    transport.subscribe?.(sessionWith(server.url(), true), events());
    await server.received(1);

    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(server.sockets[0]!.readyState).toBe(WebSocket.OPEN);
    transport[Symbol.dispose]?.();
  });

  it("disables push when the subscription is disposed, then closes when idle", async () => {
    const { transport } = setup({ idleSeconds: 0.02 });
    const subscription = transport.subscribe?.(sessionWith(server.url(), true), events());
    await server.received(1);

    subscription?.[Symbol.dispose]();

    const messages = await server.received(2);
    expect(messages[1]).toEqual({ "@type": "WebSocketPushDisable" });
    await vi.waitFor(() => expect(server.sockets[0]!.readyState).toBe(WebSocket.CLOSED));
  });

  it("reports a dropped socket, reconnects, and resumes from the last pushState", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { transport } = setup();
    const push = events();
    transport.subscribe?.(sessionWith(server.url(), true), push);
    await server.received(1);
    server.sockets[0]!.send(JSON.stringify(stateChange("s1", "p1")));
    await vi.waitFor(() => expect(push.onStateChange).toHaveBeenCalledOnce());

    server.sockets[0]!.terminate();

    await vi.waitFor(() => expect(push.onError).toHaveBeenCalledWith(expect.any(StateChangeError)));
    const messages = await server.received(2);
    expect(messages[1]).toEqual({
      "@type": "WebSocketPushEnable",
      dataTypes: null,
      pushState: "p1",
    });
    expect(server.sockets).toHaveLength(2);
    vi.mocked(Math.random).mockRestore();
    transport[Symbol.dispose]?.();
  });

  it("reports an unreadable message without dropping the socket", async () => {
    const { transport } = setup();
    const push = events();
    transport.subscribe?.(sessionWith(server.url(), true), push);
    await server.received(1);

    server.sockets[0]!.send("{invalid");
    server.sockets[0]!.send(JSON.stringify(stateChange("s2")));

    await vi.waitFor(() => expect(push.onStateChange).toHaveBeenCalledOnce());
    expect(push.onError).toHaveBeenCalledExactlyOnceWith(expect.any(StateChangeError));
    transport[Symbol.dispose]?.();
  });
});

describe("JsonMetaClient with webSocketTransport", () => {
  const sessionUrl = "https://example.test/.well-known/jmap";

  function client(
    supportsPush: boolean,
    hooks: ConstructorParameters<typeof JsonMetaClient>[0]["hooks"] = {},
  ) {
    const session = sessionWith(server.url(), supportsPush);
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json(session));
    vi.stubGlobal("fetch", fetchMock);
    const instance = new JsonMetaClient({
      sessionUrl,
      auth: "token",
      capabilities: [],
      hooks,
      transport: webSocketTransport({ createWebSocket }),
    });
    return { client: instance, fetchMock };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends batches over the socket and runs the JMAP hooks", async () => {
    const beforeJmapRequest = vi.fn<BeforeJmapRequestHook>(({ jmapRequest }) => jmapRequest);
    const afterJmapResponse = vi.fn<AfterJmapResponseHook>(({ jmapResponse }) => jmapResponse);
    const { client: jmap, fetchMock } = client(false, {
      beforeJmapRequest: [beforeJmapRequest],
      afterJmapResponse: [afterJmapResponse],
    });

    const results = Promise.all([
      jmap.api.Core.echo({ hello: "a" }, { id: "a" }),
      jmap.api.Core.echo({ hello: "b" }, { id: "b" }),
    ]);
    const [message] = await server.received(1);
    expect(message).toMatchObject({
      "@type": "Request",
      methodCalls: [
        ["Core/echo", { hello: "a" }, "a"],
        ["Core/echo", { hello: "b" }, "b"],
      ],
    });
    expect(server.headers[0]).toMatchObject({ authorization: "Bearer token" });
    server.respond(server.requests()[0]!);

    await expect(results).resolves.toEqual([{ id: "a" }, { id: "b" }]);
    expect(beforeJmapRequest).toHaveBeenCalledOnce();
    expect(afterJmapResponse).toHaveBeenCalledOnce();
    expect(afterJmapResponse.mock.calls[0]![0].jmapResponse).not.toHaveProperty("@type");
    // Only the session came over HTTP
    expect(fetchMock).toHaveBeenCalledOnce();
    jmap[Symbol.dispose]();
  });

  it("shares the socket with isolated batches", async () => {
    const { client: jmap } = client(false);

    const a = jmap.api.Core.echo({}, { id: "a" });
    const b = jmap.isolated((api) => api.Core.echo({}, { id: "b" }));
    await server.received(2);
    for (const message of server.requests()) server.respond(message);

    await Promise.all([a, b]);
    expect(server.sockets).toHaveLength(1);
    jmap[Symbol.dispose]();
  });

  it("delivers state changes to several handlers over one push subscription", async () => {
    const { client: jmap, fetchMock } = client(true);
    const first = vi.fn<OnStateChangeHandler>();
    const second = vi.fn<OnStateChangeHandler>();

    const a = await jmap.onStateChange(first);
    const b = await jmap.onStateChange(second, { pingSeconds: 5 });
    await server.received(1);
    const accountId = Object.keys(makeSession().accounts)[0]!;
    server.sockets[0]!.send(
      JSON.stringify({ "@type": "StateChange", changed: { [accountId]: { Email: "s1" } } }),
    );

    const payload = { accountId, entity: "Email", state: "s1", isPrimaryAccount: true };
    await vi.waitFor(() => expect(second).toHaveBeenCalledWith(null, payload));
    expect(first).toHaveBeenCalledWith(null, payload);
    expect(server.messages.filter((m) => m["@type"] === "WebSocketPushEnable")).toHaveLength(1);
    // No event stream was opened
    expect(fetchMock).toHaveBeenCalledOnce();

    a[Symbol.dispose]();
    b[Symbol.dispose]();
    const messages = await server.received(2);
    expect(messages[1]).toEqual({ "@type": "WebSocketPushDisable" });
    jmap[Symbol.dispose]();
  });

  it("rejects in-flight method calls and ends subscriptions when disposed", async () => {
    const { client: jmap } = client(true);
    const handler = vi.fn<OnStateChangeHandler>();
    await jmap.onStateChange(handler);
    const echo = jmap.api.Core.echo({}, { id: "a" });
    await server.received(2);

    jmap[Symbol.dispose]();

    await expect(echo).rejects.toBeInstanceOf(CancellationError);
    await expect(jmap.api.Core.echo({})).rejects.toBeInstanceOf(CancellationError);
    await expect(jmap.onStateChange(handler)).rejects.toBeInstanceOf(CancellationError);
    await vi.waitFor(() => expect(server.sockets[0]!.readyState).toBe(WebSocket.CLOSED));
    expect(handler).not.toHaveBeenCalled();
  });
});
