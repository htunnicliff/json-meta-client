// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { assertType, describe, expectTypeOf, it } from "vitest";
import { WebSocket as WsWebSocket } from "ws";

import { httpTransport, JsonMetaClient, webSocketTransport } from "../index.ts";
import type {
  DisposableLike,
  DisposeFallback,
  JmapRequest,
  JmapResponse,
  PushEvents,
  Session,
  StateChange,
  StateChangeError,
  Transport,
  TransportContext,
  TransportFactory,
  WebSocketLike,
  WebSocketTransportOptions,
} from "../index.ts";
import type { Config } from "../types.ts";

const sessionUrl = "https://example.test/session";

describe("transport types", () => {
  it("accepts the built-in factories and a custom one", () => {
    assertType<TransportFactory>(httpTransport());
    assertType<TransportFactory>(webSocketTransport());
    assertType<TransportFactory>(webSocketTransport({ idleSeconds: 10 }));
    assertType<object>(
      new JsonMetaClient({ sessionUrl, auth: "t", capabilities: [], transport: httpTransport() }),
    );
    assertType<object>(
      new JsonMetaClient({
        sessionUrl,
        auth: "t",
        capabilities: [],
        transport: (context) => {
          expectTypeOf(context).toEqualTypeOf<TransportContext>();
          return {
            send: async (request, { session, signal }) => {
              expectTypeOf(request).toEqualTypeOf<JmapRequest>();
              expectTypeOf(session).toEqualTypeOf<Session>();
              expectTypeOf(signal).toEqualTypeOf<AbortSignal>();
              const response = await context.fetch(session.apiUrl, { method: "POST", signal });
              const payload: JmapResponse = await response.json();
              return payload;
            },
            subscribe: (_session, events) => {
              expectTypeOf(events).toEqualTypeOf<PushEvents>();
              return null;
            },
          };
        },
      }),
    );
  });

  it("rejects a transport object that isn't a factory", () => {
    const transport: Transport = { send: async () => ({ methodResponses: [], sessionState: "" }) };
    expectTypeOf<{ transport: Transport }>().not.toExtend<Pick<Config<[]>, "transport">>();
    expectTypeOf<{ transport: "websocket" }>().not.toExtend<Pick<Config<[]>, "transport">>();
    expectTypeOf(transport).not.toExtend<TransportFactory>();
  });

  it("types push events", () => {
    expectTypeOf<PushEvents["onStateChange"]>().parameter(0).toEqualTypeOf<StateChange>();
    expectTypeOf<PushEvents["onError"]>().parameter(0).toEqualTypeOf<StateChangeError>();
  });

  it("accepts Node's WebSocket and the ws package as WebSocketLike", () => {
    assertType<WebSocketLike>(new globalThis.WebSocket("wss://example.test"));
    assertType<WebSocketLike>(new WsWebSocket("wss://example.test"));
    expectTypeOf(
      webSocketTransport({
        createWebSocket: (url, protocols, headers) => {
          expectTypeOf(url).toEqualTypeOf<string>();
          expectTypeOf(protocols).toEqualTypeOf<string[]>();
          expectTypeOf(headers).toEqualTypeOf<Record<string, string>>();
          return new WsWebSocket(url, protocols, { headers });
        },
      }),
    ).toEqualTypeOf<TransportFactory>();
  });

  it("rejects a createWebSocket that returns something else", () => {
    expectTypeOf<() => object>().not.toExtend<
      NonNullable<WebSocketTransportOptions["createWebSocket"]>
    >();
  });

  it("disposes the client", () => {
    const client = new JsonMetaClient({ sessionUrl, auth: "t", capabilities: [] });
    expectTypeOf(client).toExtend<Disposable>();
  });

  it("types the disconnect fallback for runtimes without Symbol.dispose", async () => {
    const client = new JsonMetaClient({ sessionUrl, auth: "t", capabilities: [] });
    expectTypeOf(client.disconnect).toEqualTypeOf<(() => void) | undefined>();
    expectTypeOf(client).toExtend<DisposeFallback>();

    const subscription = await client.onStateChange(() => {});
    expectTypeOf(subscription).toExtend<Disposable>();
    expectTypeOf(subscription.disconnect).toEqualTypeOf<(() => void) | undefined>();

    expectTypeOf<Transport["disconnect"]>().toEqualTypeOf<(() => void) | undefined>();
  });

  it("accepts a transport that disposes with disconnect", () => {
    assertType<Transport>({
      send: async () => ({ methodResponses: [], sessionState: "" }),
      subscribe: () => ({ disconnect: () => {} }),
      disconnect: () => {},
    });
    assertType<Transport>({
      send: async () => ({ methodResponses: [], sessionState: "" }),
      subscribe: async () => ({ [Symbol.dispose]: () => {} }),
    });
    expectTypeOf<{ disconnect: () => void }>().toExtend<DisposableLike>();
  });

  it("rejects a subscription with neither dispose method", () => {
    expectTypeOf<object>().not.toExtend<DisposableLike>();
    expectTypeOf<{ disconnect?: () => void }>().not.toExtend<DisposableLike>();
    expectTypeOf<{ disconnect: string }>().not.toExtend<DisposableLike>();
  });
});
