import { describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";

import {
  CancellationError,
  JmapError,
  NetworkError,
  StateChangeError,
  webSocketTransport,
} from "../../index.ts";
import type { WebSocketLike, WebSocketTransportOptions } from "../../index.ts";
import type { OnStateChangeHandler } from "../../types.ts";
import { createClient, createClientWith, uniqueName } from "./client.ts";

const transport = webSocketTransport({
  createWebSocket: (url, protocols, headers) => new WebSocket(url, protocols, { headers }),
});

/**
 * A WebSocket transport whose sockets are real `ws` sockets to Stalwart,
 * wrapped so a test can see what the client sends, drop what the server
 * sends (to simulate a half-open connection), or kill a socket
 */
function observedTransport(options: Omit<WebSocketTransportOptions, "createWebSocket"> = {}) {
  const sockets: WebSocket[] = [];
  const sent: Record<string, unknown>[] = [];
  const state = { deaf: false, sendHeaders: true };
  const factory = webSocketTransport({
    ...options,
    createWebSocket: (url, protocols, headers): WebSocketLike => {
      const socket = new WebSocket(url, protocols, state.sendHeaders ? { headers } : {});
      sockets.push(socket);
      return {
        get readyState() {
          return socket.readyState;
        },
        get protocol() {
          return socket.protocol;
        },
        get binaryType() {
          return socket.binaryType;
        },
        set binaryType(value) {
          // The transport only ever asks for ArrayBuffers
          if (value === "arraybuffer") {
            socket.binaryType = value;
          }
        },
        send: (data) => {
          sent.push(JSON.parse(data));
          socket.send(data);
        },
        close: (code, reason) => socket.close(code, reason),
        addEventListener: (type, listener) => {
          socket.addEventListener(type, (event: unknown) => {
            // A deaf socket stays open but hears nothing, like a half-open TCP connection
            if (type === "message" && state.deaf) {
              return;
            }
            listener(event);
          });
        },
      };
    },
  });
  /** The messages of a type the client has sent */
  const sentOfType = (type: string) => sent.filter((message) => message["@type"] === type);
  return { transport: factory, sockets, sent, sentOfType, state };
}

/** Wait until a socket has closed */
async function closed(socket: WebSocket): Promise<void> {
  await vi.waitFor(() => expect(socket.readyState).toBe(WebSocket.CLOSED), { timeout: 10_000 });
}

/** Create a Mailbox, returning the new Mailbox state */
async function createMailbox(client: ReturnType<typeof createClient<["mail"]>>): Promise<string> {
  const { newState } = await client.api.Mailbox.set({
    create: { box: { name: uniqueName("WebSocket") } },
  });
  return newState;
}

describe("WebSocket transport", () => {
  it("is advertised by the server", async () => {
    using client = createClientWith({ transport }, "mail");
    const session = await client.session;

    expect(session.capabilities["urn:ietf:params:jmap:websocket"]).toMatchObject({
      url: expect.stringMatching(/^wss?:\/\//),
    });
  });

  it("settles a batch of method calls over the socket", async () => {
    using client = createClientWith({ transport }, "mail");

    const [echo, mailboxes] = await Promise.all([
      client.api.Core.echo({ hello: "world" }),
      client.api.Mailbox.get({ ids: null }),
    ]);

    expect(echo).toEqual({ hello: "world" });
    expect(mailboxes.list.length).toBeGreaterThan(0);
  });

  it("resolves result references across a batch", async () => {
    using client = createClientWith({ transport }, "mail");

    const query = client.api.Mailbox.query({});
    const mailboxes = await client.api.Mailbox.get({ ids: query.resultRef("/ids") });

    expect(mailboxes.list.length).toBeGreaterThan(0);
  });

  it("delivers a Mailbox change over WebSocket push", async () => {
    using client = createClientWith({ transport }, "mail");
    const session = await client.session;
    expect(session.capabilities["urn:ietf:params:jmap:websocket"]?.supportsPush).toBe(true);
    const accountId = session.primaryAccounts["urn:ietf:params:jmap:mail"]!;
    const handler = vi.fn<OnStateChangeHandler>();

    // Resolves once the socket is open and push is enabled on it, so the
    // change below, sent on the same socket, comes after it
    using _ = await client.onStateChange(handler);

    const { newState } = await client.api.Mailbox.set({
      create: { box: { name: uniqueName("WebSocket state change") } },
    });

    await vi.waitFor(
      () => {
        expect(handler).toHaveBeenCalledWith(null, {
          accountId,
          entity: "Mailbox",
          state: newState,
          isPrimaryAccount: true,
        });
      },
      { timeout: 10_000 },
    );
    expect(handler).not.toHaveBeenCalledWith(expect.anything(), undefined);
  });

  it("sends the auth headers on the socket upgrade, and fails without them", async () => {
    const observed = observedTransport();
    observed.state.sendHeaders = false;
    using client = createClientWith({ transport: observed.transport }, "mail");

    const error = await client.api.Core.echo({}).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(NetworkError);
    observed.state.sendHeaders = true;
    await expect(client.api.Core.echo({ ok: true })).resolves.toEqual({ ok: true });
  });

  it("shares one socket between concurrent batches and settles each by its own id", async () => {
    const observed = observedTransport();
    using client = createClientWith({ transport: observed.transport }, "mail");

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) => client.isolated((api) => api.Core.echo({ index }))),
    );

    expect(results).toEqual(Array.from({ length: 20 }, (_, index) => ({ index })));
    expect(observed.sockets).toHaveLength(1);
    expect(observed.sentOfType("Request")).toHaveLength(20);
  });

  it("rejects a method call with JmapError while the rest of the batch resolves", async () => {
    using client = createClientWith({ transport }, "mail");

    const [missing, echo] = await Promise.allSettled([
      client.api.Mailbox.get({ accountId: "missing-account" }),
      client.api.Core.echo({ ok: true }),
    ]);

    expect(missing).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({ type: "accountNotFound" }),
    });
    expect(missing.status === "rejected" && missing.reason).toBeInstanceOf(JmapError);
    expect(echo).toEqual({ status: "fulfilled", value: { ok: true } });
  });

  it("rejects a whole batch with JmapError when the server answers with a RequestError", async () => {
    using client = createClientWith({ transport }, "mail");
    const session = await client.session;
    const { maxCallsInRequest } = session.capabilities["urn:ietf:params:jmap:core"];

    const results = await Promise.allSettled(
      Array.from({ length: maxCallsInRequest + 1 }, (_, index) => client.api.Core.echo({ index })),
    );

    const reasons = new Set(results.map((result) => result.status === "rejected" && result.reason));
    expect(reasons.size).toBe(1);
    const [error] = reasons;
    expect(error).toBeInstanceOf(JmapError);
    expect(error).toMatchObject({
      type: "urn:ietf:params:jmap:error:limit",
      limit: "maxCallsInRequest",
    });
    // The socket survives a RequestError
    await expect(client.api.Core.echo({ after: true })).resolves.toEqual({ after: true });
  });

  it("closes an idle socket and reconnects for the next batch", async () => {
    const observed = observedTransport({ idleSeconds: 0.2 });
    using client = createClientWith({ transport: observed.transport }, "mail");

    await client.api.Core.echo({ first: true });
    await closed(observed.sockets[0]!);

    await expect(client.api.Core.echo({ second: true })).resolves.toEqual({ second: true });
    expect(observed.sockets).toHaveLength(2);
  });

  it("rejects a batch in flight with CancellationError when the client is disposed", async () => {
    const observed = observedTransport();
    const client = createClientWith({ transport: observed.transport }, "mail");
    await client.api.Core.echo({});
    // Nothing answers, so the batch is still in flight when the client goes
    observed.state.deaf = true;

    const pending = client.api.Core.echo({ late: true });
    await vi.waitFor(() => expect(observed.sentOfType("Request")).toHaveLength(2));
    client[Symbol.dispose]();

    await expect(pending).rejects.toBeInstanceOf(CancellationError);
    await closed(observed.sockets[0]!);
  });

  it("fails a request that gets no response within requestTimeoutSeconds, then reconnects", async () => {
    const observed = observedTransport({ requestTimeoutSeconds: 0.5 });
    using client = createClientWith({ transport: observed.transport }, "mail");
    await client.api.Core.echo({});

    observed.state.deaf = true;
    const error = await client.api.Core.echo({}).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(NetworkError);
    expect(error).toMatchObject({ message: expect.stringContaining("No response") });
    await closed(observed.sockets[0]!);

    observed.state.deaf = false;
    await expect(client.api.Core.echo({ again: true })).resolves.toEqual({ again: true });
    expect(observed.sockets).toHaveLength(2);
  });
});

describe("WebSocket push", () => {
  it("shares one push subscription between handlers, and disables it when the last leaves", async () => {
    const observed = observedTransport();
    using client = createClientWith({ transport: observed.transport }, "mail");
    const first = vi.fn<OnStateChangeHandler>();
    const second = vi.fn<OnStateChangeHandler>();

    const a = await client.onStateChange(first);
    const b = await client.onStateChange(second, { pingSeconds: 5 });
    const newState = await createMailbox(client);

    const change = expect.objectContaining({ entity: "Mailbox", state: newState });
    await vi.waitFor(
      () => {
        expect(first).toHaveBeenCalledWith(null, change);
        expect(second).toHaveBeenCalledWith(null, change);
      },
      { timeout: 10_000 },
    );
    expect(observed.sentOfType("WebSocketPushEnable")).toHaveLength(1);

    a[Symbol.dispose]();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(observed.sentOfType("WebSocketPushDisable")).toHaveLength(0);
    b[Symbol.dispose]();
    await vi.waitFor(() => expect(observed.sentOfType("WebSocketPushDisable")).toHaveLength(1));

    // With push off, a later change reaches neither handler
    const calls = first.mock.calls.length + second.mock.calls.length;
    await createMailbox(client);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(first.mock.calls.length + second.mock.calls.length).toBe(calls);
  });

  it("delivers a change made by another client", async () => {
    using client = createClientWith({ transport }, "mail");
    const other = createClient("mail");
    const handler = vi.fn<OnStateChangeHandler>();
    using _ = await client.onStateChange(handler);
    // Push is enabled, but the server has no acknowledgment for it; a round
    // trip on the same socket shows it has read the enable message
    await client.api.Core.echo({});

    const newState = await createMailbox(other);

    await vi.waitFor(
      () =>
        expect(handler).toHaveBeenCalledWith(
          null,
          expect.objectContaining({ entity: "Mailbox", state: newState }),
        ),
      { timeout: 10_000 },
    );
  });

  it("sends heartbeats that the server answers, keeping push healthy", async () => {
    const observed = observedTransport({ heartbeatSeconds: 0.2 });
    using client = createClientWith({ transport: observed.transport }, "mail");
    const handler = vi.fn<OnStateChangeHandler>();
    using _ = await client.onStateChange(handler);

    await vi.waitFor(
      () => expect(observed.sentOfType("Request").length).toBeGreaterThanOrEqual(4),
      { timeout: 10_000 },
    );

    expect(observed.sentOfType("Request")[0]).toMatchObject({
      methodCalls: [["Core/echo", {}, "heartbeat"]],
    });
    expect(observed.sockets).toHaveLength(1);
    expect(observed.sockets[0]!.readyState).toBe(WebSocket.OPEN);
    expect(handler).not.toHaveBeenCalledWith(expect.any(StateChangeError), undefined);
  });

  it("reconnects when the socket drops, and delivers changes again", async () => {
    const observed = observedTransport();
    using client = createClientWith({ transport: observed.transport }, "mail");
    const handler = vi.fn<OnStateChangeHandler>();
    using _ = await client.onStateChange(handler);

    observed.sockets[0]!.terminate();

    await vi.waitFor(
      () => expect(handler).toHaveBeenCalledWith(expect.any(StateChangeError), undefined),
      { timeout: 10_000 },
    );
    await vi.waitFor(() => expect(observed.sentOfType("WebSocketPushEnable")).toHaveLength(2), {
      timeout: 10_000,
    });
    const newState = await createMailbox(client);
    await vi.waitFor(
      () =>
        expect(handler).toHaveBeenCalledWith(
          null,
          expect.objectContaining({ entity: "Mailbox", state: newState }),
        ),
      { timeout: 10_000 },
    );
    expect(observed.sockets).toHaveLength(2);
  });

  it("detects a half-open socket by a missed heartbeat, and recovers", async () => {
    const observed = observedTransport({ heartbeatSeconds: 0.3 });
    using client = createClientWith({ transport: observed.transport }, "mail");
    const handler = vi.fn<OnStateChangeHandler>();
    using _ = await client.onStateChange(handler);

    // The socket stays open, but nothing the server sends arrives
    observed.state.deaf = true;
    await vi.waitFor(
      () => expect(handler).toHaveBeenCalledWith(expect.any(StateChangeError), undefined),
      { timeout: 10_000 },
    );
    const error = handler.mock.calls.find(([error]) => error)?.[0];
    expect(error?.cause).toMatchObject({ message: expect.stringContaining("No heartbeat") });
    await closed(observed.sockets[0]!);

    observed.state.deaf = false;
    await vi.waitFor(() => expect(observed.sockets).toHaveLength(2), { timeout: 10_000 });
    const newState = await createMailbox(client);
    await vi.waitFor(
      () =>
        expect(handler).toHaveBeenCalledWith(
          null,
          expect.objectContaining({ entity: "Mailbox", state: newState }),
        ),
      { timeout: 10_000 },
    );
  });

  it("ends push when the client is disposed", async () => {
    const observed = observedTransport();
    const client = createClientWith({ transport: observed.transport }, "mail");
    const handler = vi.fn<OnStateChangeHandler>();
    await client.onStateChange(handler);

    client[Symbol.dispose]();

    await closed(observed.sockets[0]!);
    await createMailbox(createClient("mail"));
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(handler).not.toHaveBeenCalled();
    await expect(client.onStateChange(handler)).rejects.toBeInstanceOf(CancellationError);
  });
});
