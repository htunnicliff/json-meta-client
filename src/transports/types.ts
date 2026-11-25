// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { StateChangeError } from "../errors/index.ts";
import type { DisposableLike, DisposeFallback } from "../internal/disposable.ts";
import type {
  Request as JmapRequest,
  Response as JmapResponse,
  Session,
  StateChange,
} from "../rfc-types/core/index.ts";

//#region transport-factory
/**
 * Creates a client's {@link Transport}. The client calls it once, in its
 * constructor, so two clients never share a connection.
 */
export interface TransportFactory {
  (context: TransportContext): Transport;
}
//#endregion transport-factory

//#region transport-context
/**
 * What the client gives its transport
 */
export interface TransportContext {
  /**
   * Apply the client's `auth` to a request, without running hooks. The
   * request is not changed; an authenticated copy is returned.
   */
  authenticate: (request: Request) => Promise<Request>;
  /**
   * The client's fetch: applies `auth`, runs `beforeFetch` and `afterFetch`,
   * and rejects with `HttpError` or `NetworkError`
   */
  fetch: (url: string | URL, init?: RequestInit) => Promise<Response>;
}
//#endregion transport-context

//#region transport
/**
 * Carries JMAP Requests to the server, and optionally state changes back
 */
export interface Transport extends DisposeFallback {
  /**
   * Send a JMAP Request and return its Response. Reject an aborted send with
   * `CancellationError`, and other failures with a `JsonMetaError`.
   */
  send(request: JmapRequest, options: TransportSendOptions): Promise<JmapResponse>;
  /**
   * Deliver state changes for a session. Return `null`, or leave this out,
   * to use the event stream instead. Return a promise to make
   * `onStateChange` wait, for example until the channel is open.
   */
  subscribe?(session: Session, events: PushEvents): DisposableLike | Promise<DisposableLike> | null;
  /**
   * Release connections when the client is disposed. On a runtime without
   * `Symbol.dispose`, the client calls {@link Transport.disconnect} instead.
   */
  [Symbol.dispose]?(): void;
}
//#endregion transport

/**
 * Options for {@link Transport.send}
 */
export interface TransportSendOptions {
  /** The current session */
  session: Session;
  /**
   * Aborted when this send should stop, which today is when the client is
   * disposed. Reject the send with `CancellationError` when it aborts. It
   * says nothing about other sends: the client disposes the transport
   * separately.
   */
  signal: AbortSignal;
}

//#region push-events
/**
 * Where a push channel reports what it receives
 */
export interface PushEvents {
  onStateChange: (change: StateChange) => void;
  onError: (error: StateChangeError) => void;
}
//#endregion push-events
