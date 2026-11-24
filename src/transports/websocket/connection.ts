// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { CancellationError, JmapError, NetworkError, UnknownError } from "../../errors/index.ts";
import type {
  Request as JmapRequest,
  Response as JmapResponse,
  WebSocketPushDisable,
  WebSocketPushEnable,
  WebSocketRequest,
  WebSocketStateChange,
} from "../../rfc-types/core/index.ts";
import type { WebSocketLike } from "./types.ts";

/** `WebSocket.OPEN` */
const OPEN = 1;

export interface ConnectionOptions {
  /** Seconds with nothing pending and no push before the socket closes */
  idleSeconds: number;
  /** Called once, when the socket has closed for any reason */
  onClose: (connection: Connection, error: Error) => void;
  /** Called with each `StateChange` the server pushes */
  onStateChange: (change: WebSocketStateChange) => void;
  /** Called with a push message that can't be read */
  onUnreadableMessage: (error: unknown) => void;
}

/**
 * One socket speaking the JMAP WebSocket subprotocol. It sends JMAP Requests,
 * settles each by its `requestId`, routes pushed state changes, and closes
 * itself when idle.
 */
export class Connection {
  constructor(url: string, socket: WebSocketLike, options: ConnectionOptions) {
    this.url = url;
    this.#socket = socket;
    this.#options = options;
    const opened = Promise.withResolvers<void>();
    this.opened = opened.promise;
    // Nothing may await `opened`, as with a connection used only for push
    this.opened.catch(() => {});

    socket.addEventListener("open", () => {
      if (socket.protocol !== "jmap") {
        const error = new NetworkError(
          `The server did not accept the "jmap" WebSocket subprotocol`,
          { cause: { protocol: socket.protocol }, request: undefined },
        );
        opened.reject(error);
        this.close(error);
        return;
      }
      this.#open = true;
      opened.resolve();
      if (this.#push) this.#sendPush();
      this.#updateIdleTimer();
    });
    socket.addEventListener("message", (event: { data: unknown }) => this.#route(event.data));
    socket.addEventListener("error", (event: unknown) => {
      const error = new NetworkError("WebSocket connection failed", {
        cause: event,
        request: undefined,
      });
      opened.reject(error);
      this.#finish(error);
    });
    socket.addEventListener("close", (event: { code?: number; reason?: string }) => {
      const error = new NetworkError(
        `WebSocket closed (${event.code ?? "no code"}${event.reason ? `: ${event.reason}` : ""})`,
        { cause: event, request: undefined },
      );
      opened.reject(error);
      this.#finish(error);
    });
  }

  /** The socket URL */
  readonly url: string;

  /** Settles once the socket is open and has accepted the `jmap` subprotocol */
  readonly opened: Promise<void>;

  readonly #socket: WebSocketLike;
  readonly #options: ConnectionOptions;

  /** JMAP Requests waiting for their Response, by request id */
  readonly #pending = new Map<string, PromiseWithResolvers<JmapResponse>>();

  #nextId = 0;
  /** Requests waiting for the socket to open */
  #connecting = 0;
  #idleTimer: ReturnType<typeof setTimeout> | undefined;
  #closed = false;
  #retired = false;
  #push = false;
  #pushState: string | undefined;
  #open = false;

  /** Whether the socket has closed, or is closing */
  get closed(): boolean {
    return this.#closed;
  }

  /**
   * Send a JMAP Request and settle it from the Response with its id
   */
  request = async (request: JmapRequest): Promise<JmapResponse> => {
    this.#connecting++;
    try {
      await this.opened;
    } finally {
      this.#connecting--;
    }
    if (this.#closed) {
      throw new NetworkError("WebSocket closed", { cause: undefined, request: undefined });
    }
    const id = String(++this.#nextId);
    const handle = Promise.withResolvers<JmapResponse>();
    this.#pending.set(id, handle);
    this.#updateIdleTimer();
    const message: WebSocketRequest = { ...request, "@type": "Request", id };
    try {
      this.#socket.send(JSON.stringify(message));
    } catch (cause) {
      this.#pending.delete(id);
      this.#updateIdleTimer();
      throw new NetworkError("Failed to send over the WebSocket", { cause, request: undefined });
    }
    return handle.promise;
  };

  /**
   * Ask the server to push state changes on this connection, or stop. Push
   * keeps the connection open.
   */
  setPush = (enabled: boolean, pushState?: string): void => {
    const wasEnabled = this.#push;
    this.#push = enabled;
    this.#pushState = pushState;
    this.#updateIdleTimer();
    // Before the socket opens, the open handler enables push
    if (this.#open && (enabled || wasEnabled)) this.#sendPush();
  };

  #sendPush(): void {
    if (this.#closed || this.#socket.readyState !== OPEN) return;
    const pushState = this.#pushState;
    const message: WebSocketPushEnable | WebSocketPushDisable = this.#push
      ? { "@type": "WebSocketPushEnable", dataTypes: null, ...(pushState ? { pushState } : {}) }
      : { "@type": "WebSocketPushDisable" };
    try {
      this.#socket.send(JSON.stringify(message));
    } catch (cause) {
      this.close(
        new NetworkError("Failed to send over the WebSocket", { cause, request: undefined }),
      );
    }
  }

  /**
   * Accept no more requests, and close once the pending ones settle
   */
  retire = (): void => {
    this.#retired = true;
    this.#push = false;
    this.#updateIdleTimer();
  };

  /**
   * Close the socket, rejecting pending requests with the given error
   */
  close = (error: Error = new CancellationError("The WebSocket was closed")): void => {
    if (this.#closed) return;
    this.#finish(error);
    try {
      this.#socket.close(1000);
    } catch {
      // Already closing
    }
  };

  /**
   * Settle what the socket was waiting for, once, when it closes
   */
  #finish(error: Error): void {
    if (this.#closed) return;
    this.#closed = true;
    clearTimeout(this.#idleTimer);
    for (const { reject } of this.#pending.values()) reject(error);
    this.#pending.clear();
    this.#options.onClose(this, error);
  }

  /**
   * Start the idle timer when nothing keeps the connection open, and stop it
   * otherwise. A retired connection closes as soon as it is idle.
   */
  #updateIdleTimer(): void {
    clearTimeout(this.#idleTimer);
    this.#idleTimer = undefined;
    if (this.#closed || this.#pending.size > 0 || this.#connecting > 0 || this.#push) return;
    if (this.#retired) {
      this.close();
      return;
    }
    const { idleSeconds } = this.#options;
    if (!Number.isFinite(idleSeconds)) return;
    this.#idleTimer = setTimeout(() => this.close(), Math.max(0, idleSeconds) * 1000);
    // Don't keep a Node process alive just to close an idle socket
    if (typeof this.#idleTimer === "object" && "unref" in this.#idleTimer) {
      this.#idleTimer.unref();
    }
  }

  /**
   * Route one message from the server
   */
  #route(data: unknown): void {
    let message: unknown;
    try {
      message = JSON.parse(
        typeof data === "string" ? data : new TextDecoder().decode(toBytes(data)),
      );
    } catch (error) {
      this.#options.onUnreadableMessage(error);
      return;
    }
    if (typeof message !== "object" || message === null) return;
    const { "@type": type, requestId } = message as { "@type"?: unknown; requestId?: unknown };
    if (type === "Response") {
      this.#settle(requestId, (handle) => {
        const { "@type": _type, requestId: _requestId, ...response } = fields(message);
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        handle.resolve(response as unknown as JmapResponse);
      });
    } else if (type === "RequestError") {
      const error = requestError(message);
      if (typeof requestId === "string") {
        this.#settle(requestId, (handle) => handle.reject(error));
      } else {
        // The server couldn't tell which request failed, so none can wait on it
        for (const handle of this.#pending.values()) handle.reject(error);
        this.#pending.clear();
        this.#updateIdleTimer();
      }
    } else if (type === "StateChange") {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      this.#options.onStateChange(message as WebSocketStateChange);
    }
  }

  #settle(requestId: unknown, settle: (handle: PromiseWithResolvers<JmapResponse>) => void): void {
    if (typeof requestId !== "string") return;
    const handle = this.#pending.get(requestId);
    if (!handle) return;
    this.#pending.delete(requestId);
    settle(handle);
    this.#updateIdleTimer();
  }
}

/**
 * The error for a `RequestError` message
 */
function requestError(message: object): Error {
  const { "@type": _type, requestId: _requestId, ...problem } = fields(message);
  return JmapError.isProblemDetails(problem)
    ? new JmapError(problem.detail ?? "JMAP request error", problem)
    : new UnknownError("Unknown JMAP request error", { cause: message });
}

/**
 * A message's own fields
 */
function fields(message: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(message));
}

/**
 * The bytes of a binary message
 */
function toBytes(data: unknown): Uint8Array | ArrayBuffer {
  if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
    return data instanceof ArrayBuffer
      ? data
      : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new TypeError("Unsupported WebSocket message data");
}
