import { afterEach, describe, expect, it, vi } from "vitest";

import { makeSession } from "../../__test__/fixtures.ts";
import { HttpError, NetworkError, StateChangeError } from "../../errors/index.ts";
import type { StateChange } from "../../rfc-types/core/index.ts";
import type { PushEvents } from "../../transports/types.ts";
import { openEventStream, reconnectDelay } from "../event-stream.ts";
import type { EventStreamTiming } from "../event-stream.ts";
import type { HttpClient } from "../http.ts";

const encoder = new TextEncoder();

const change = (state: string): StateChange => ({
  "@type": "StateChange",
  changed: { account: { Email: state } },
});

/** One connection the fake server accepted */
interface Connection {
  request: Request;
  /** Send text on the stream */
  send: (text: string) => void;
  /** End the stream as a server would */
  end: () => void;
}

type Respond = (request: Request) => Response | Error | undefined;

/**
 * A fake HTTP client that answers each event-stream request with a stream
 * the test writes to, unless `respond` answers it first
 */
function setup(options: { respond?: Respond; timing?: EventStreamTiming; pingSeconds?: number }) {
  const connections: Connection[] = [];
  const fetch = vi.fn<HttpClient["fetch"]>(async (url, init) => {
    const request = new Request(url, init);
    const answer = options.respond?.(request);
    if (answer instanceof Error) {
      throw answer;
    }
    if (answer) {
      return { request, response: answer };
    }
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start: (c) => {
        controller = c;
      },
    });
    init?.signal?.addEventListener("abort", () => {
      try {
        controller.error(init.signal!.reason);
      } catch {
        // Already closed
      }
    });
    connections.push({
      request,
      send: (text) => controller.enqueue(encoder.encode(text)),
      end: () => controller.close(),
    });
    return {
      request,
      response: new Response(body, { headers: { "content-type": "text/event-stream" } }),
    };
  });
  const events = {
    onStateChange: vi.fn<PushEvents["onStateChange"]>(),
    onError: vi.fn<PushEvents["onError"]>(),
  };
  const session = makeSession();
  // spellchecker:disable-next-line
  session.eventSourceUrl =
    "https://example.test/events?types={types}&closeafter={closeafter}&ping={ping}";
  const open = () =>
    openEventStream({ fetch }, session, events, options.pingSeconds ?? 30, {
      retryMilliseconds: 1,
      random: () => 0,
      ...options.timing,
    });
  return { connections, fetch, events, open };
}

const subscriptions: Disposable[] = [];
afterEach(() => {
  for (const subscription of subscriptions.splice(0)) {
    subscription[Symbol.dispose]();
  }
});

describe(openEventStream, () => {
  it("connects with the event-stream headers and delivers state changes", async () => {
    const { connections, events, open } = setup({});
    subscriptions.push(await open());
    await vi.waitFor(() => expect(connections).toHaveLength(1));

    const { request } = connections[0]!;
    // spellchecker:disable-next-line
    expect(request.url).toBe("https://example.test/events?types=*&closeafter=no&ping=30");
    expect(request.headers.get("accept")).toBe("text/event-stream");
    expect(request.headers.has("last-event-id")).toBe(false);

    connections[0]!.send(`event: state\ndata: ${JSON.stringify(change("a"))}\n\n`);
    connections[0]!.send(`data: ${JSON.stringify(change("b"))}\n\n`);
    await vi.waitFor(() => expect(events.onStateChange).toHaveBeenCalledTimes(2));
    expect(events.onStateChange.mock.calls).toEqual([[change("a")], [change("b")]]);
    expect(events.onError).not.toHaveBeenCalled();
  });

  it("ignores pings and other event types", async () => {
    const { connections, events, open } = setup({});
    subscriptions.push(await open());
    await vi.waitFor(() => expect(connections).toHaveLength(1));

    connections[0]!.send('event: ping\ndata: {"interval":30}\n\n');
    connections[0]!.send("event: other\ndata: not json\n\n");
    connections[0]!.send(`event: state\ndata: ${JSON.stringify(change("a"))}\n\n`);
    await vi.waitFor(() => expect(events.onStateChange).toHaveBeenCalledOnce());
    expect(events.onError).not.toHaveBeenCalled();
  });

  it("reports data that isn't JSON and keeps reading", async () => {
    const { connections, events, open } = setup({});
    subscriptions.push(await open());
    await vi.waitFor(() => expect(connections).toHaveLength(1));

    connections[0]!.send("data: {invalid\n\n");
    connections[0]!.send(`data: ${JSON.stringify(change("a"))}\n\n`);
    await vi.waitFor(() => expect(events.onStateChange).toHaveBeenCalledOnce());
    expect(events.onError).toHaveBeenCalledExactlyOnceWith(expect.any(StateChangeError));
    expect(events.onError.mock.calls[0]![0].cause).toBeInstanceOf(SyntaxError);
  });

  it("reconnects when the stream ends, sending the last event ID", async () => {
    const { connections, events, open } = setup({});
    subscriptions.push(await open());
    await vi.waitFor(() => expect(connections).toHaveLength(1));

    connections[0]!.send(`id: 41\ndata: ${JSON.stringify(change("a"))}\n\n`);
    connections[0]!.end();
    await vi.waitFor(() => expect(connections).toHaveLength(2));

    expect(connections[1]!.request.headers.get("last-event-id")).toBe("41");
    expect(events.onError).not.toHaveBeenCalled();
  });

  it("waits the reconnection time the server sets", async () => {
    const { connections, open } = setup({});
    subscriptions.push(await open());
    await vi.waitFor(() => expect(connections).toHaveLength(1));

    connections[0]!.send("retry: 200\n");
    const ended = Date.now();
    connections[0]!.end();
    await vi.waitFor(() => expect(connections).toHaveLength(2), { timeout: 2000 });

    expect(Date.now() - ended).toBeGreaterThanOrEqual(190);
  });

  it("reports a network failure and reconnects", async () => {
    const failure = new NetworkError("offline", { cause: undefined, request: undefined });
    let calls = 0;
    const { connections, events, fetch, open } = setup({
      respond: () => (calls++ === 0 ? failure : undefined),
    });
    subscriptions.push(await open());

    await vi.waitFor(() => expect(connections).toHaveLength(1));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(events.onError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ name: "StateChangeError", cause: failure }),
    );
  });

  it("stops after the server refuses the connection", async () => {
    const refusal = new HttpError("Unauthorized", {
      request: new Request("https://example.test/events"),
      response: new Response(null, { status: 401 }),
    });
    const { events, fetch, open } = setup({ respond: () => refusal });
    subscriptions.push(await open());

    await vi.waitFor(() => expect(events.onError).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetch).toHaveBeenCalledOnce();
    expect(events.onError.mock.calls[0]![0]).toMatchObject({
      name: "StateChangeError",
      cause: refusal,
    });
  });

  it("stops without an error on HTTP 204", async () => {
    const { events, fetch, open } = setup({
      respond: () => new Response(null, { status: 204 }),
    });
    subscriptions.push(await open());

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetch).toHaveBeenCalledOnce();
    expect(events.onError).not.toHaveBeenCalled();
  });

  it("doesn't reconnect or report anything once disposed", async () => {
    const { connections, events, fetch, open } = setup({});
    const subscription = await open();
    await vi.waitFor(() => expect(connections).toHaveLength(1));

    subscription[Symbol.dispose]();
    expect(connections[0]!.request.signal.aborted).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetch).toHaveBeenCalledOnce();
    expect(events.onError).not.toHaveBeenCalled();
  });

  it("reconnects when nothing, not even a comment, arrives in time", async () => {
    const { connections, events, open } = setup({
      timing: { deadConnectionMilliseconds: 50 },
    });
    subscriptions.push(await open());
    await vi.waitFor(() => expect(connections).toHaveLength(1));

    // Activity keeps the connection alive past the deadline
    for (let tick = 0; tick < 4; tick++) {
      // oxlint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 25));
      connections[0]!.send(": keep-alive\n");
    }
    expect(connections).toHaveLength(1);

    await vi.waitFor(() => expect(connections).toHaveLength(2));
    expect(connections[0]!.request.signal.aborted).toBe(true);
    expect(events.onError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        name: "StateChangeError",
        message: expect.stringContaining("sent nothing"),
      }),
    );
  });

  it("waits two ping intervals before treating the connection as dead", async () => {
    vi.useFakeTimers();
    try {
      const { connections, open } = setup({ pingSeconds: 10 });
      subscriptions.push(await open());
      await vi.waitFor(() => expect(connections).toHaveLength(1));

      await vi.advanceTimersByTimeAsync(19_000);
      expect(connections[0]!.request.signal.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1000);
      expect(connections[0]!.request.signal.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe(reconnectDelay, () => {
  it("doubles the reconnection time for each failure in a row, up to the cap", () => {
    const delays = [0, 1, 2, 3, 10].map((failures) =>
      reconnectDelay(2000, failures, 30_000, () => 0),
    );
    expect(delays).toEqual([2000, 4000, 8000, 16_000, 30_000]);
  });

  it("shortens the delay by up to half at random", () => {
    expect(reconnectDelay(2000, 0, 30_000, () => 0.5)).toBe(1500);
    expect(reconnectDelay(2000, 0, 30_000, () => 0.999)).toBeGreaterThan(1000);
  });
});
