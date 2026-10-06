import { createEventSource, type EventSourceOptions } from "eventsource-client";
import nock from "nock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { core } from "../capabilities/core.ts";
import { mail } from "../capabilities/mail.ts";
import { Client } from "../client.ts";
import { StateChangeError } from "../errors/state-change-error.ts";

vi.mock("eventsource-client", () => ({ createEventSource: vi.fn<typeof createEventSource>() }));

const host = "https://example.test";
const accountId = "primary-account";
const close = vi.fn<() => void>();

function createClient() {
  return new Client({
    sessionUrl: `${host}/session`,
    bearerToken: "token",
    capabilities: [mail],
  });
}

type StateChangeHandler = Parameters<ReturnType<typeof createClient>["onStateChange"]>[0];

async function subscribe(handler: StateChangeHandler) {
  await createClient().onStateChange(handler);
  const options = vi.mocked(createEventSource).mock.calls[0]?.[0];
  if (!options || typeof options !== "object" || options instanceof URL || !options.onMessage) {
    throw new Error("Expected an event source message callback");
  }
  return (data: string) => options.onMessage!({ data, event: "message", id: undefined });
}

describe("Client.onStateChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createEventSource).mockImplementation(
      (options: EventSourceOptions | string | URL) => ({
        close,
        connect: vi.fn<() => void>(),
        lastEventId: undefined,
        url:
          typeof options === "object" && !(options instanceof URL)
            ? String(options.url)
            : String(options),
        readyState: "open",
        [Symbol.iterator](): never {
          throw new Error("Not supported");
        },
        async *[Symbol.asyncIterator]() {},
      }),
    );
    nock(host)
      .get("/session")
      .reply(200, {
        apiUrl: `${host}/api`,
        uploadUrl: `${host}/upload/{accountId}`,
        downloadUrl: `${host}/download/{accountId}/{blobId}`,
        primaryAccounts: { [mail.urn]: accountId },
        capabilities: { [core.urn]: {}, [mail.urn]: {} },
        // spellchecker:disable-next-line
        eventSourceUrl: `${host}/events?types={types}&closeafter={closeafter}&ping={ping}`,
      });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it("delivers a null error and a change for each entity in each account", async () => {
    const handler = vi.fn<StateChangeHandler>();
    const emit = await subscribe(handler);
    emit(
      JSON.stringify({
        "@type": "StateChange",
        changed: {
          [accountId]: { Email: "email-state", Mailbox: "mailbox-state" },
          secondary: { Email: "secondary-state" },
        },
      }),
    );
    expect(handler.mock.calls).toEqual([
      [null, { accountId, entity: "Email", state: "email-state", isPrimaryAccount: true }],
      [null, { accountId, entity: "Mailbox", state: "mailbox-state", isPrimaryAccount: true }],
      [
        null,
        {
          accountId: "secondary",
          entity: "Email",
          state: "secondary-state",
          isPrimaryAccount: false,
        },
      ],
    ]);
  });

  it.each([
    { data: "{invalid", causeType: SyntaxError },
    { data: JSON.stringify({ "@type": "StateChange" }), causeType: TypeError },
    {
      data: JSON.stringify({ "@type": "StateChange", changed: { [accountId]: null } }),
      causeType: TypeError,
    },
  ])("reports malformed messages as StateChangeError: $data", async ({ data, causeType }) => {
    const handler = vi.fn<StateChangeHandler>();
    const emit = await subscribe(handler);
    expect(() => emit(data)).not.toThrow();
    expect(handler).toHaveBeenCalledExactlyOnceWith(expect.any(StateChangeError), undefined);
    const error = handler.mock.calls[0]![0];
    if (!(error instanceof StateChangeError)) throw new Error("Expected StateChangeError");
    expect(error.cause).toBeInstanceOf(causeType);
    expect(error.cause).toMatchObject({ message: error.message });
  });

  it("continues delivering changes after a malformed message", async () => {
    const handler = vi.fn<StateChangeHandler>();
    const emit = await subscribe(handler);
    emit("{invalid");
    emit(JSON.stringify({ "@type": "StateChange", changed: { [accountId]: { Email: "next" } } }));
    expect(handler.mock.calls).toEqual([
      [expect.any(StateChangeError), undefined],
      [null, { accountId, entity: "Email", state: "next", isPrimaryAccount: true }],
    ]);
  });

  it("ignores other message types and empty changes", async () => {
    const handler = vi.fn<StateChangeHandler>();
    const emit = await subscribe(handler);
    emit(JSON.stringify({ "@type": "Ping" }));
    emit(JSON.stringify({ "@type": "StateChange", changed: {} }));
    expect(handler).not.toHaveBeenCalled();
  });
});
