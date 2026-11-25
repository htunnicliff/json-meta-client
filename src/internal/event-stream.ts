import { HttpError, StateChangeError } from "../errors/index.ts";
import type { Session } from "../rfc-types/core/index.ts";
import type { PushEvents } from "../transports/types.ts";
import { disposable } from "./disposable.ts";
import type { DisposeFallback } from "./disposable.ts";
import { expandURITemplate } from "./expand-uri-template.ts";
import type { HttpClient } from "./http.ts";
import { isStateChange } from "./read-state-changes.ts";
import { parseEventStream } from "./sse-reader.ts";

/**
 * How the event stream times its reconnects. Tests shorten them.
 */
export interface EventStreamTiming {
  /** The reconnection time until the server sends `retry`. Defaults to 2 s. */
  retryMilliseconds?: number;
  /** The longest wait between reconnects. Defaults to 60 s. */
  maxRetryMilliseconds?: number;
  /**
   * How long the stream may stay silent before the connection counts as
   * dead. Defaults to two ping intervals; no limit when pings are off.
   */
  deadConnectionMilliseconds?: number;
  /** A random number in [0, 1), for jitter. Defaults to `Math.random`. */
  random?: () => number;
}

const defaultRetryMilliseconds = 2000;
const defaultMaxRetryMilliseconds = 60_000;

/**
 * Open the session's event stream, the push channel used when the transport
 * provides none. The connection stays open, and reconnects when it ends or
 * fails, until it is disposed or the server refuses it.
 */
export async function openEventStream(
  http: Pick<HttpClient, "fetch">,
  session: Session,
  events: PushEvents,
  pingSeconds: number,
  timing: EventStreamTiming = {},
): Promise<Disposable & DisposeFallback> {
  const url = expandURITemplate(session.eventSourceUrl, {
    types: "*",
    // spellchecker:disable-next-line
    closeafter: "no",
    ping: pingSeconds.toFixed(0),
  });
  const controller = new AbortController();
  void connect({
    http,
    url,
    events,
    signal: controller.signal,
    deadConnectionMilliseconds:
      timing.deadConnectionMilliseconds ?? (pingSeconds > 0 ? pingSeconds * 2000 : undefined),
    retryMilliseconds: timing.retryMilliseconds ?? defaultRetryMilliseconds,
    maxRetryMilliseconds: timing.maxRetryMilliseconds ?? defaultMaxRetryMilliseconds,
    random: timing.random ?? Math.random,
  });
  return disposable(() => controller.abort());
}

interface ConnectOptions {
  http: Pick<HttpClient, "fetch">;
  url: string;
  events: PushEvents;
  /** Aborted when the event stream is disposed */
  signal: AbortSignal;
  deadConnectionMilliseconds: number | undefined;
  retryMilliseconds: number;
  maxRetryMilliseconds: number;
  random: () => number;
}

/**
 * Keep the event stream connected until it is disposed or the server
 * refuses it. Reports failures through `events.onError` and never throws.
 */
async function connect(options: ConnectOptions): Promise<void> {
  const { events, signal } = options;
  let lastEventId = "";
  let retryMilliseconds = options.retryMilliseconds;
  let failures = 0;

  while (!signal.aborted) {
    const connection = new AbortController();
    const abort = () => connection.abort(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const keepAlive = () => {
      clearTimeout(deadline);
      if (options.deadConnectionMilliseconds !== undefined) {
        deadline = setTimeout(
          () => connection.abort(new DeadConnectionError(options.deadConnectionMilliseconds!)),
          options.deadConnectionMilliseconds,
        );
      }
    };
    try {
      const headers = new Headers({ accept: "text/event-stream", "cache-control": "no-store" });
      if (lastEventId) {
        headers.set("last-event-id", lastEventId);
      }
      keepAlive();
      // oxlint-disable-next-line no-await-in-loop
      const { response } = await options.http.fetch(
        options.url,
        { headers, signal: connection.signal },
        true,
      );
      // HTTP 204 tells the client to stop reconnecting
      if (response.status === 204 || !response.body) {
        return;
      }
      failures = 0;
      // oxlint-disable-next-line no-await-in-loop
      for await (const item of parseEventStream(readText(response.body, keepAlive))) {
        if (item.type === "retry") {
          retryMilliseconds = item.milliseconds;
        } else {
          lastEventId = item.lastEventId;
          if (item.type === "message" && (item.event === "state" || item.event === "message")) {
            dispatch(item.data, events);
          }
        }
      }
    } catch (error) {
      if (signal.aborted) {
        return;
      }
      const cause: unknown = connection.signal.aborted ? connection.signal.reason : error;
      if (cause instanceof HttpError) {
        events.onError(new StateChangeError("The server refused the event stream", { cause }));
        return;
      }
      events.onError(
        cause instanceof DeadConnectionError
          ? new StateChangeError(cause.message, { cause })
          : new StateChangeError("Event-stream connection failed", { cause }),
      );
      failures++;
    } finally {
      clearTimeout(deadline);
      signal.removeEventListener("abort", abort);
      connection.abort();
    }
    // oxlint-disable-next-line no-await-in-loop
    await sleep(
      reconnectDelay(retryMilliseconds, failures, options.maxRetryMilliseconds, options.random),
      signal,
    );
  }
}

/**
 * Parse an event's data and deliver it if it is a `StateChange`
 */
function dispatch(data: string, events: PushEvents): void {
  let message: unknown;
  try {
    message = JSON.parse(data);
  } catch (error) {
    events.onError(
      new StateChangeError(
        error instanceof Error
          ? error.message
          : "An error occurred when parsing a state change message payload",
        { cause: error },
      ),
    );
    return;
  }
  if (isStateChange(message)) {
    events.onStateChange(message);
  }
}

/**
 * How long to wait before reconnecting: the reconnection time, doubled for
 * each failed attempt in a row and capped, then shortened by up to half at
 * random, so that many clients don't reconnect at once after an outage
 */
export function reconnectDelay(
  retryMilliseconds: number,
  failures: number,
  maxRetryMilliseconds: number,
  random: () => number,
): number {
  const backoff = Math.min(retryMilliseconds * 2 ** failures, maxRetryMilliseconds);
  return backoff * (1 - random() / 2);
}

/**
 * Decode a response body as UTF-8 text, calling `onChunk` as each chunk
 * arrives
 */
async function* readText(
  body: ReadableStream<Uint8Array<ArrayBuffer>>,
  onChunk: () => void,
): AsyncGenerator<string> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      // oxlint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      onChunk();
      yield value;
    }
  } finally {
    void reader.cancel().catch(() => {});
  }
}

/**
 * Wait, returning early when the signal aborts
 */
function sleep(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, milliseconds);
    signal.addEventListener("abort", done, { once: true });
  });
}

/**
 * The reason a connection is aborted when the stream goes silent
 */
class DeadConnectionError extends Error {
  override name = "DeadConnectionError";

  constructor(milliseconds: number) {
    super(`The event stream sent nothing for ${milliseconds / 1000} s, so the client reconnected`);
  }
}
