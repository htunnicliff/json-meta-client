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

/** The Request a heartbeat sends: the cheapest one every server accepts */
const HEARTBEAT: JmapRequest = {
  using: ["urn:ietf:params:jmap:core"],
  methodCalls: [["Core/echo", {}, "heartbeat"]],
};

export interface ConnectionOptions {
  /** Seconds with nothing pending and no push before the socket closes */
  idleSeconds: number;
  /**
   * Seconds a request may wait for its Response before the socket is
   * treated as dead and closed
   */
  requestTimeoutSeconds: number;
  /**
   * Seconds between heartbeats while push is enabled. A heartbeat still
   * unanswered when the next one is due closes the socket.
   */
  heartbeatSeconds: number;
  /** Called once, when the socket has closed for any reason */
  onClose: (connection: Connection, error: Error) => void;
  /** Called once, with the first message the server sends that can be read */
  onHealthy: (connection: Connection) => void;
  /** Called with each `StateChange` the server pushes */
  onStateChange: (connection: Connection, change: WebSocketStateChange) => void;
}

interface Pending extends PromiseWithResolvers<JmapResponse> {
  /** Stop waiting: clear the timeout and the abort listener */
  cleanup: () => void;
}

/**
 * One socket speaking the JMAP WebSocket subprotocol. It sends JMAP Requests,
 * settles each by its `requestId`, routes pushed state changes, checks that a
 * push socket is alive, and closes itself when idle.
 */
export class Connection {
  constructor(url: string, socket: WebSocketLike, options: ConnectionOptions) {
    this.url = url;
    this.#socket = socket;
    this.#options = options;
    // A browser delivers binary messages as a `Blob` by default, which can
    // only be read asynchronously, out of order with the messages after it
    if ("binaryType" in socket) {
      socket.binaryType = "arraybuffer";
    }
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
      if (this.#push) {
        this.#sendPush();
      }
      this.#update();
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
  readonly #pending = new Map<string, Pending>();

  #nextId = 0;
  /** Requests waiting for the socket to open */
  #connecting = 0;
  #idleTimer: ReturnType<typeof setTimeout> | undefined;
  #heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  /** The id of the heartbeat waiting for its Response */
  #heartbeat: string | undefined;
  #closed = false;
  #retired = false;
  #healthy = false;
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
  request = async (request: JmapRequest, signal?: AbortSignal): Promise<JmapResponse> => {
    this.#connecting++;
    try {
      await this.opened;
    } finally {
      this.#connecting--;
    }
    if (signal?.aborted) {
      throw new CancellationError("The request was cancelled");
    }
    if (this.#closed) {
      throw new NetworkError("WebSocket closed", { cause: undefined, request: undefined });
    }
    const id = String(++this.#nextId);
    const promise = this.#track(id, signal, this.#options.requestTimeoutSeconds);
    const message: WebSocketRequest = { ...request, "@type": "Request", id };
    try {
      this.#socket.send(JSON.stringify(message));
    } catch (cause) {
      this.#pending.get(id)?.cleanup();
      this.#pending.delete(id);
      this.#update();
      throw new NetworkError("Failed to send over the WebSocket", { cause, request: undefined });
    }
    return promise;
  };

  /**
   * Wait for the Response with this id, giving up after the timeout or when
   * the signal aborts
   */
  #track(
    id: string,
    signal: AbortSignal | undefined,
    timeoutSeconds: number,
  ): Promise<JmapResponse> {
    const handle = Promise.withResolvers<JmapResponse>();
    const onAbort = () => {
      if (!this.#pending.has(id)) {
        return;
      }
      this.#pending.delete(id);
      cleanup();
      handle.reject(new CancellationError("The request was cancelled"));
      this.#update();
    };
    const timer = Number.isFinite(timeoutSeconds)
      ? setTimeout(
          () => {
            // The socket can't be trusted once a Response goes missing: it may
            // be half-open, or the Response may have been unreadable
            this.close(
              new NetworkError(`No response from the server within ${timeoutSeconds} seconds`, {
                cause: undefined,
                request: undefined,
              }),
            );
          },
          Math.max(0, timeoutSeconds) * 1000,
        )
      : undefined;
    unref(timer);
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    this.#pending.set(id, { ...handle, cleanup });
    this.#update();
    return handle.promise;
  }

  /**
   * Ask the server to push state changes on this connection, or stop. Push
   * keeps the connection open, and sends a heartbeat while it is on.
   */
  setPush = (enabled: boolean, pushState?: string): void => {
    const wasEnabled = this.#push;
    this.#push = enabled;
    this.#pushState = pushState;
    // Before the socket opens, the open handler enables push
    if (this.#open && (enabled || wasEnabled)) {
      this.#sendPush();
    }
    this.#update();
  };

  #sendPush(): void {
    if (this.#closed || this.#socket.readyState !== OPEN) {
      return;
    }
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
   * Accept no more requests, stop push, and close once the pending requests
   * settle
   */
  retire = (): void => {
    this.#retired = true;
    if (this.#push) {
      this.setPush(false);
    } else {
      this.#update();
    }
  };

  /**
   * Close the socket, rejecting pending requests with the given error
   */
  close = (error: Error = new CancellationError("The WebSocket was closed")): void => {
    if (this.#closed) {
      return;
    }
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
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    clearTimeout(this.#idleTimer);
    clearInterval(this.#heartbeatTimer);
    for (const { reject, cleanup } of this.#pending.values()) {
      cleanup();
      reject(error);
    }
    this.#pending.clear();
    this.#options.onClose(this, error);
  }

  /**
   * Run the heartbeat while push is on, and the idle timer when nothing keeps
   * the connection open. A retired connection closes as soon as it is idle.
   */
  #update(): void {
    if (this.#closed) {
      return;
    }
    this.#updateHeartbeat();
    clearTimeout(this.#idleTimer);
    this.#idleTimer = undefined;
    if (this.#pending.size > 0 || this.#connecting > 0 || this.#push) {
      return;
    }
    if (this.#retired) {
      this.close();
      return;
    }
    const { idleSeconds } = this.#options;
    if (!Number.isFinite(idleSeconds)) {
      return;
    }
    this.#idleTimer = setTimeout(() => this.close(), Math.max(0, idleSeconds) * 1000);
    // Don't keep a Node process alive just to close an idle socket
    unref(this.#idleTimer);
  }

  #updateHeartbeat(): void {
    const { heartbeatSeconds } = this.#options;
    const wanted = this.#push && this.#open && Number.isFinite(heartbeatSeconds);
    if (wanted && this.#heartbeatTimer === undefined) {
      this.#heartbeatTimer = setInterval(this.#beat, Math.max(0, heartbeatSeconds) * 1000);
      unref(this.#heartbeatTimer);
    } else if (!wanted && this.#heartbeatTimer !== undefined) {
      clearInterval(this.#heartbeatTimer);
      this.#heartbeatTimer = undefined;
      // Stop waiting for a heartbeat, so it doesn't hold the socket open
      const id = this.#heartbeat;
      this.#heartbeat = undefined;
      const pending = id === undefined ? undefined : this.#pending.get(id);
      if (id !== undefined && pending) {
        pending.cleanup();
        this.#pending.delete(id);
        pending.reject(new CancellationError("Push was disabled"));
      }
    }
  }

  /**
   * Send a heartbeat, or close the socket if the last one went unanswered
   */
  readonly #beat = (): void => {
    if (this.#heartbeat !== undefined) {
      this.close(
        new NetworkError(`No heartbeat response within ${this.#options.heartbeatSeconds} seconds`, {
          cause: undefined,
          request: undefined,
        }),
      );
      return;
    }
    const id = `heartbeat-${++this.#nextId}`;
    this.#heartbeat = id;
    // The next beat checks for the response, so the request needs no timeout
    this.#track(id, undefined, Infinity).then(
      () => {
        if (this.#heartbeat === id) {
          this.#heartbeat = undefined;
        }
      },
      () => {},
    );
    const message: WebSocketRequest = { ...HEARTBEAT, "@type": "Request", id };
    try {
      this.#socket.send(JSON.stringify(message));
    } catch (cause) {
      this.close(
        new NetworkError("Failed to send over the WebSocket", { cause, request: undefined }),
      );
    }
  };

  /**
   * Route one message from the server
   */
  #route(data: unknown): void {
    let message: unknown;
    try {
      message = JSON.parse(
        typeof data === "string" ? data : new TextDecoder().decode(toBytes(data)),
      );
    } catch (cause) {
      // The message may have been the Response to a pending request, which
      // would then never settle, so nothing on this socket can be trusted
      this.close(
        new NetworkError("Received an unreadable WebSocket message", {
          cause,
          request: undefined,
        }),
      );
      return;
    }
    if (!this.#healthy) {
      this.#healthy = true;
      this.#options.onHealthy(this);
    }
    if (typeof message !== "object" || message === null) {
      return;
    }
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
        for (const handle of this.#pending.values()) {
          handle.cleanup();
          handle.reject(error);
        }
        this.#pending.clear();
        this.#heartbeat = undefined;
        this.#update();
      }
    } else if (type === "StateChange") {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      this.#options.onStateChange(this, message as WebSocketStateChange);
    }
  }

  #settle(requestId: unknown, settle: (handle: Pending) => void): void {
    if (typeof requestId !== "string") {
      return;
    }
    const handle = this.#pending.get(requestId);
    if (!handle) {
      return;
    }
    this.#pending.delete(requestId);
    handle.cleanup();
    settle(handle);
    this.#update();
  }
}

/**
 * Let a Node process exit while only this timer is running
 */
function unref(timer: ReturnType<typeof setTimeout> | undefined): void {
  if (typeof timer === "object" && timer !== null && "unref" in timer) {
    timer.unref();
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
