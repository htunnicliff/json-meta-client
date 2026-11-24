// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import {
  CancellationError,
  ConfigurationError,
  NetworkError,
  StateChangeError,
} from "../../errors/index.ts";
import { disposable } from "../../internal/disposable.ts";
import type {
  Request as JmapRequest,
  Response as JmapResponse,
  Session,
  WebSocketSessionCapabilities,
} from "../../rfc-types/core/index.ts";
import type {
  PushEvents,
  Transport,
  TransportContext,
  TransportFactory,
  TransportSendOptions,
} from "../types.ts";
import { Connection } from "./connection.ts";
import type { WebSocketLike, WebSocketTransportOptions } from "./types.ts";

export type { WebSocketLike, WebSocketTransportOptions } from "./types.ts";

const WEBSOCKET_URN = "urn:ietf:params:jmap:websocket";

/** The longest wait between push reconnection attempts */
const MAX_RECONNECT_DELAY_MS = 30_000;

/**
 * Send JMAP Requests over the JMAP WebSocket subprotocol (RFC 8887), on one
 * socket that every batch of the client shares. When the session supports
 * push, state changes arrive on the same socket.
 */
export function webSocketTransport(options: WebSocketTransportOptions = {}): TransportFactory {
  return (context) => new WebSocketTransport(context, options);
}

/**
 * Open a socket with the global `WebSocket`, which can't send headers
 */
function createGlobalWebSocket(url: string, protocols: string[]): WebSocketLike {
  if (typeof globalThis.WebSocket !== "function") {
    throw new ConfigurationError(
      "No global WebSocket is available; pass `createWebSocket` to `webSocketTransport`",
    );
  }
  return new globalThis.WebSocket(url, protocols);
}

/**
 * The push subscription, which outlives any one connection
 */
interface Push {
  events: PushEvents;
  /** The latest `pushState` the server sent, to resume from after reconnecting */
  pushState: string | undefined;
  /** Failed connection attempts since the last success */
  attempts: number;
  retryTimer: ReturnType<typeof setTimeout> | undefined;
}

class WebSocketTransport implements Transport {
  constructor(context: TransportContext, options: WebSocketTransportOptions) {
    this.#context = context;
    this.#createWebSocket = options.createWebSocket ?? createGlobalWebSocket;
    this.#idleSeconds = options.idleSeconds ?? 60;
  }

  readonly #context: TransportContext;
  readonly #createWebSocket: NonNullable<WebSocketTransportOptions["createWebSocket"]>;
  readonly #idleSeconds: number;

  /** The connection new requests go to */
  #connection: Connection | undefined;
  /** The connection push is enabled on */
  #pushConnection: Connection | undefined;
  /** Connections still settling requests after the socket URL changed */
  readonly #retired = new Set<Connection>();
  /** The socket URL from the most recent session */
  #url: string | undefined;
  #push: Push | undefined;
  #disposed = false;
  readonly #signals = new WeakSet<AbortSignal>();

  send = async (
    request: JmapRequest,
    { session, signal }: TransportSendOptions,
  ): Promise<JmapResponse> => {
    if (signal.aborted || this.#disposed) {
      throw new CancellationError("The client was disposed");
    }
    if (!this.#signals.has(signal)) {
      this.#signals.add(signal);
      signal.addEventListener("abort", () => this[Symbol.dispose](), { once: true });
    }
    const { url } = webSocketCapability(session) ?? {};
    if (!url) {
      throw new ConfigurationError(
        `The client uses the WebSocket transport, but the session doesn't advertise ${WEBSOCKET_URN}`,
      );
    }
    this.#url = url;
    const connection = await this.#connect(url);
    return connection.request(request);
  };

  subscribe = (session: Session, events: PushEvents): Disposable | null => {
    const capability = webSocketCapability(session);
    if (!capability?.supportsPush || this.#disposed) return null;
    this.#url = capability.url;
    const push: Push = { events, pushState: undefined, attempts: 0, retryTimer: undefined };
    this.#push = push;
    void this.#enablePush(push);
    return disposable(() => {
      if (this.#push !== push) return;
      this.#push = undefined;
      clearTimeout(push.retryTimer);
      const connection = this.#pushConnection;
      this.#pushConnection = undefined;
      if (connection && !connection.closed) connection.setPush(false);
    });
  };

  [Symbol.dispose] = (): void => {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#push) clearTimeout(this.#push.retryTimer);
    this.#push = undefined;
    this.#pushConnection = undefined;
    const error = new CancellationError("The client was disposed");
    for (const connection of [this.#connection, ...this.#retired]) connection?.close(error);
    this.#connection = undefined;
    this.#retired.clear();
  };

  /**
   * The open connection to a socket URL, opening one if there is none. A
   * connection to a different URL is retired: it settles what it has and
   * closes.
   */
  async #connect(url: string): Promise<Connection> {
    const current = this.#connection;
    if (current && !current.closed && current.url === url) return current;
    if (current && !current.closed) {
      current.retire();
      if (!current.closed) this.#retired.add(current);
    }
    const connection = await this.#open(url);
    this.#connection = connection;
    if (this.#push && this.#pushConnection !== connection) this.#attachPush(this.#push, connection);
    return connection;
  }

  /**
   * Create a connection, authenticating the socket request. Concurrent
   * callers share the same connection.
   */
  #open(url: string): Promise<Connection> {
    if (this.#opening?.url === url) return this.#opening.connection;
    const connection = (async () => {
      const request = await this.#context.authenticate(new Request(url));
      const headers = Object.fromEntries(request.headers);
      if (this.#disposed) throw new CancellationError("The client was disposed");
      let socket: WebSocketLike;
      try {
        socket = this.#createWebSocket(url, ["jmap"], headers);
      } catch (cause) {
        if (cause instanceof ConfigurationError) throw cause;
        throw new NetworkError("Failed to open the WebSocket", { cause, request: undefined });
      }
      return new Connection(url, socket, {
        idleSeconds: this.#idleSeconds,
        onClose: this.#onClose,
        onStateChange: (change) => {
          const push = this.#push;
          if (!push || this.#pushConnection === undefined) return;
          if (change.pushState) push.pushState = change.pushState;
          push.events.onStateChange(change);
        },
        onUnreadableMessage: (cause) => {
          this.#push?.events.onError(
            new StateChangeError("Received an unreadable WebSocket message", { cause }),
          );
        },
      });
    })();
    const opening = { url, connection };
    this.#opening = opening;
    const clear = () => {
      if (this.#opening === opening) this.#opening = undefined;
    };
    connection.then(clear, clear);
    return connection;
  }

  #opening: { url: string; connection: Promise<Connection> } | undefined;

  readonly #onClose = (connection: Connection, error: Error): void => {
    this.#retired.delete(connection);
    if (this.#connection === connection) this.#connection = undefined;
    if (this.#pushConnection !== connection) return;
    this.#pushConnection = undefined;
    const push = this.#push;
    if (!push || this.#disposed) return;
    push.events.onError(new StateChangeError("WebSocket push connection closed", { cause: error }));
    this.#scheduleReconnect(push);
  };

  /**
   * Connect and enable push, retrying with backoff on failure
   */
  async #enablePush(push: Push): Promise<void> {
    const url = this.#url;
    if (this.#push !== push || !url) return;
    try {
      const connection = await this.#connect(url);
      if (this.#push !== push) return;
      if (this.#pushConnection !== connection) this.#attachPush(push, connection);
      await connection.opened;
      push.attempts = 0;
    } catch (cause) {
      if (this.#push !== push || this.#disposed) return;
      // A connection that closed has already reported it and scheduled a retry
      if (this.#pushConnection || push.retryTimer !== undefined) return;
      push.events.onError(new StateChangeError("WebSocket push connection failed", { cause }));
      this.#scheduleReconnect(push);
    }
  }

  /**
   * Enable push on a connection once it opens, resuming from the last
   * `pushState`
   */
  #attachPush(push: Push, connection: Connection): void {
    const previous = this.#pushConnection;
    if (previous && previous !== connection && !previous.closed) previous.setPush(false);
    this.#pushConnection = connection;
    connection.setPush(true, push.pushState);
  }

  #scheduleReconnect(push: Push): void {
    clearTimeout(push.retryTimer);
    const delay = Math.min(MAX_RECONNECT_DELAY_MS, 1000 * 2 ** push.attempts);
    push.attempts++;
    push.retryTimer = setTimeout(
      () => {
        push.retryTimer = undefined;
        void this.#enablePush(push);
      },
      delay / 2 + Math.random() * (delay / 2),
    );
  }
}

/**
 * The session's WebSocket capability, if it advertises one
 */
function webSocketCapability(session: Session): WebSocketSessionCapabilities | undefined {
  return session.capabilities[WEBSOCKET_URN];
}
