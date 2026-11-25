// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

//#region websocket-like
/**
 * The part of the WHATWG `WebSocket` that the WebSocket transport uses.
 * Node's global `WebSocket`, the browser's, and the `ws` package's all
 * satisfy it.
 */
export interface WebSocketLike {
  readonly readyState: number;
  /** The subprotocol the server selected */
  readonly protocol: string;
  /** Set to `"arraybuffer"` where it exists, so binary messages can be read in order */
  binaryType?: string;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(
    type: "open" | "message" | "close" | "error",
    // The event types differ between implementations, so the transport reads
    // only `data`, `code` and `reason`, each defensively
    // oxlint-disable-next-line typescript/no-explicit-any
    listener: (event: any) => void,
  ): void;
}
//#endregion websocket-like

//#region websocket-transport-options
/**
 * Options for {@link webSocketTransport}
 */
export interface WebSocketTransportOptions {
  /**
   * Open a socket. `headers` holds the result of applying the client's
   * `auth` to a request for the socket URL. Defaults to
   * `new WebSocket(url, protocols)`, which sends no headers.
   */
  createWebSocket?: (
    url: string,
    protocols: string[],
    headers: Record<string, string>,
  ) => WebSocketLike;
  /**
   * Seconds with no pending requests and no push subscription before the
   * socket closes. The next request reconnects. Defaults to `60`; pass
   * `Infinity` to keep the socket open until the client is disposed.
   */
  idleSeconds?: number;
  /**
   * Seconds a JMAP Request may wait for its Response. When one waits longer,
   * the transport treats the socket as dead: it closes it, rejects every
   * request waiting on it with `NetworkError`, and reconnects on the next
   * request. Defaults to `60`; pass `Infinity` to wait forever.
   */
  requestTimeoutSeconds?: number;
  /**
   * Seconds between heartbeats on the push socket. RFC 8887 has no ping, so
   * while push is enabled the transport sends a `Core/echo` Request this
   * often. If one is still unanswered when the next is due, the socket is
   * treated as dead and push reconnects. Heartbeats don't run the JMAP hooks.
   * Defaults to `30`; pass `Infinity` to turn them off.
   */
  heartbeatSeconds?: number;
}
//#endregion websocket-transport-options
