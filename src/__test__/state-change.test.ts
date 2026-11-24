// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { createEventSource } from "eventsource-client";
import type { EventSourceOptions } from "eventsource-client";
import nock from "nock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contacts } from "../capabilities/contacts.ts";
import { core } from "../capabilities/core.ts";
import { mail } from "../capabilities/mail.ts";
import { defineCapability } from "../capability.ts";
import { JsonMetaClient } from "../client.ts";
import { CancellationError } from "../errors/cancellation-error.ts";
import { StateChangeError } from "../errors/state-change-error.ts";
import type { Session } from "../rfc-types/core/index.ts";
import type { PushEvents, Transport, TransportFactory } from "../transports/types.ts";
import type { CapabilityOption, OnStateChangeHandler } from "../types.ts";

vi.mock("eventsource-client", () => ({ createEventSource: vi.fn<typeof createEventSource>() }));

const host = "https://example.test";
const accountId = "primary-account";
const close = vi.fn<() => void>();

/** Accounts by ID, each listing the given capability URNs */
function accountsWith(urnsByAccountId: Record<string, string[]>): Session["accounts"] {
  return Object.fromEntries(
    Object.entries(urnsByAccountId).map(([id, urns]) => [
      id,
      {
        name: id,
        isPersonal: true,
        isReadOnly: false,
        accountCapabilities: Object.fromEntries(urns.map((urn) => [urn, {}])),
      },
    ]),
  );
}

/** Serves a session with the given primary accounts and accounts */
function mockSession(
  primaryAccounts: Record<string, string>,
  urnsByAccountId: Record<string, string[]>,
): void {
  nock.cleanAll();
  nock(host)
    .get("/session")
    .reply(200, {
      apiUrl: `${host}/api`,
      uploadUrl: `${host}/upload/{accountId}`,
      downloadUrl: `${host}/download/{accountId}/{blobId}`,
      accounts: accountsWith(urnsByAccountId),
      primaryAccounts,
      capabilities: { [core.urn]: {}, [mail.urn]: {}, [contacts.urn]: {} },
      // spellchecker:disable-next-line
      eventSourceUrl: `${host}/events?types={types}&closeafter={closeafter}&ping={ping}`,
    });
}

async function subscribe(
  handler: OnStateChangeHandler,
  capabilities: ReadonlyArray<CapabilityOption> = [mail],
) {
  const client = new JsonMetaClient({
    sessionUrl: `${host}/session`,
    auth: "token",
    capabilities,
  });
  await client.onStateChange(handler);
  const options = vi.mocked(createEventSource).mock.calls[0]?.[0];
  if (!options || typeof options !== "object" || options instanceof URL || !options.onMessage) {
    throw new Error("Expected an event source message callback");
  }
  return (data: string) => options.onMessage!({ data, event: "message", id: undefined });
}

/**
 * Whether a state change for the entity in the account is reported as being
 * in the primary account
 */
async function isPrimaryAccount(
  entity: string,
  accountId: string,
  capabilities?: ReadonlyArray<CapabilityOption>,
): Promise<boolean | undefined> {
  const handler = vi.fn<OnStateChangeHandler>();
  const emit = await subscribe(handler, capabilities);
  emit(JSON.stringify({ "@type": "StateChange", changed: { [accountId]: { [entity]: "state" } } }));
  expect(handler).toHaveBeenCalledExactlyOnceWith(null, expect.objectContaining({ entity }));
  return handler.mock.calls[0]![1]?.isPrimaryAccount;
}

function client(transport?: TransportFactory) {
  return new JsonMetaClient({
    sessionUrl: `${host}/session`,
    auth: "token",
    capabilities: [mail],
    ...(transport ? { transport } : {}),
  });
}

/** Emit a message on the nth event source the client opened */
function emitOn(index: number, data: string): void {
  const options = vi.mocked(createEventSource).mock.calls[index]?.[0];
  if (!options || typeof options !== "object" || options instanceof URL) {
    throw new Error(`Expected event source ${index}`);
  }
  options.onMessage!({ data, event: "message", id: undefined });
}

describe("onStateChange", () => {
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
    mockSession({ [mail.urn]: accountId }, { [accountId]: [mail.urn], secondary: [mail.urn] });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it("delivers a null error and a change for each entity in each account", async () => {
    const handler = vi.fn<OnStateChangeHandler>();
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
    const handler = vi.fn<OnStateChangeHandler>();
    const emit = await subscribe(handler);
    expect(() => emit(data)).not.toThrow();
    expect(handler).toHaveBeenCalledExactlyOnceWith(expect.any(StateChangeError), undefined);
    const error = handler.mock.calls[0]![0];
    if (!(error instanceof StateChangeError)) throw new Error("Expected StateChangeError");
    expect(error.cause).toBeInstanceOf(causeType);
    expect(error.cause).toMatchObject({ message: error.message });
  });

  it("continues delivering changes after a malformed message", async () => {
    const handler = vi.fn<OnStateChangeHandler>();
    const emit = await subscribe(handler);
    emit("{invalid");
    emit(JSON.stringify({ "@type": "StateChange", changed: { [accountId]: { Email: "next" } } }));
    expect(handler.mock.calls).toEqual([
      [expect.any(StateChangeError), undefined],
      [null, { accountId, entity: "Email", state: "next", isPrimaryAccount: true }],
    ]);
  });

  it("ignores other message types and empty changes", async () => {
    const handler = vi.fn<OnStateChangeHandler>();
    const emit = await subscribe(handler);
    emit(JSON.stringify({ "@type": "Ping" }));
    emit(JSON.stringify({ "@type": "StateChange", changed: {} }));
    expect(handler).not.toHaveBeenCalled();
  });

  describe("isPrimaryAccount", () => {
    describe("with a mail primary account A and a contacts primary account B", () => {
      beforeEach(() => {
        mockSession(
          { [mail.urn]: "A", [contacts.urn]: "B" },
          { A: [mail.urn, contacts.urn], B: [mail.urn, contacts.urn], C: [mail.urn] },
        );
      });

      it.each([
        { entity: "Email", account: "A", expected: true },
        { entity: "ContactCard", account: "B", expected: true },
        { entity: "Email", account: "B", expected: false },
        { entity: "ContactCard", account: "A", expected: false },
      ])("is $expected for $entity in $account", async ({ entity, account, expected }) => {
        await expect(isPrimaryAccount(entity, account, ["mail", "contacts"])).resolves.toBe(
          expected,
        );
      });

      it.each([
        { account: "A", expected: true },
        { account: "B", expected: true },
        { account: "C", expected: false },
      ])(
        "is $expected for the push-only EmailDelivery in $account, by any configured capability's primary",
        async ({ account, expected }) => {
          await expect(
            isPrimaryAccount("EmailDelivery", account, ["mail", "contacts"]),
          ).resolves.toBe(expected);
        },
      );

      it("is false for a push-only type in the primary account of a capability that isn't configured", async () => {
        await expect(isPrimaryAccount("EmailDelivery", "B", ["mail"])).resolves.toBe(false);
      });

      it("treats an entity whose Entity/get has no default account like a push-only type", async () => {
        const tasks = defineCapability({
          urn: "urn:example:tasks",
          entities: ["Task"],
          defaultAccount: { "*": "primary", "Task/get": null },
        });

        await expect(isPrimaryAccount("Task", "A", ["mail", tasks])).resolves.toBe(true);
      });
    });

    describe("for a push-only type on a session that names no primary account", () => {
      it("is true in the session's only account", async () => {
        mockSession({}, { only: [] });

        await expect(isPrimaryAccount("EmailDelivery", "only")).resolves.toBe(true);
      });

      it("is false when the session has several accounts", async () => {
        mockSession({}, { one: [], two: [] });

        await expect(isPrimaryAccount("EmailDelivery", "one")).resolves.toBe(false);
      });

      it("is false in an account the session doesn't list", async () => {
        mockSession({}, { only: [] });

        await expect(isPrimaryAccount("EmailDelivery", "unlisted")).resolves.toBe(false);
      });
    });

    describe("on a contacts-only session", () => {
      beforeEach(() => {
        mockSession(
          { [contacts.urn]: "contacts-account" },
          { "contacts-account": [contacts.urn], shared: [contacts.urn] },
        );
      });

      it.each([
        { account: "contacts-account", expected: true },
        { account: "shared", expected: false },
      ])("is $expected for ContactCard in $account", async ({ account, expected }) => {
        await expect(isPrimaryAccount("ContactCard", account, ["contacts"])).resolves.toBe(
          expected,
        );
      });
    });

    describe("when the session names no primary account for the owner", () => {
      it("is true in the only account that supports the owner's capability", async () => {
        mockSession({ [mail.urn]: "A" }, { A: [mail.urn], B: [mail.urn, contacts.urn] });

        await expect(isPrimaryAccount("ContactCard", "B", ["mail", "contacts"])).resolves.toBe(
          true,
        );
      });

      it.each(["A", "B"])(
        "is false in %s when several accounts support the owner's capability",
        async (account) => {
          mockSession(
            { [mail.urn]: "A" },
            { A: [mail.urn, contacts.urn], B: [mail.urn, contacts.urn] },
          );

          await expect(
            isPrimaryAccount("ContactCard", account, ["mail", "contacts"]),
          ).resolves.toBe(false);
        },
      );

      it("is false when no account supports the owner's capability", async () => {
        mockSession({ [mail.urn]: "A" }, { A: [mail.urn] });

        await expect(isPrimaryAccount("ContactCard", "A", ["mail", "contacts"])).resolves.toBe(
          false,
        );
      });
    });
  });

  describe("sharing a push channel", () => {
    const change = JSON.stringify({
      "@type": "StateChange",
      changed: { [accountId]: { Email: "s1" } },
    });
    const payload = { accountId, entity: "Email", state: "s1", isPrimaryAccount: true };

    it("opens one event stream for handlers that ask for the same ping interval", async () => {
      const jmap = client();
      const first = vi.fn<OnStateChangeHandler>();
      const second = vi.fn<OnStateChangeHandler>();

      await jmap.onStateChange(first);
      await jmap.onStateChange(second);
      emitOn(0, change);

      expect(createEventSource).toHaveBeenCalledOnce();
      expect(first).toHaveBeenCalledExactlyOnceWith(null, payload);
      expect(second).toHaveBeenCalledExactlyOnceWith(null, payload);
    });

    it("opens one event stream per ping interval", async () => {
      const jmap = client();

      await jmap.onStateChange(vi.fn<OnStateChangeHandler>());
      await jmap.onStateChange(vi.fn<OnStateChangeHandler>(), { pingSeconds: 5 });

      expect(createEventSource).toHaveBeenCalledTimes(2);
      const urls = vi.mocked(createEventSource).mock.results.map(({ value }) => value.url);
      expect(urls).toEqual([expect.stringContaining("ping=30"), expect.stringContaining("ping=5")]);
    });

    it("closes the event stream when the last handler leaves", async () => {
      const jmap = client();
      const first = vi.fn<OnStateChangeHandler>();
      const second = vi.fn<OnStateChangeHandler>();
      const a = await jmap.onStateChange(first);
      const controller = new AbortController();
      await jmap.onStateChange(second, { signal: controller.signal });

      a[Symbol.dispose]();
      emitOn(0, change);
      expect(close).not.toHaveBeenCalled();
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledOnce();

      controller.abort();
      await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());

      // A new handler opens a new stream
      await jmap.onStateChange(vi.fn<OnStateChangeHandler>());
      expect(createEventSource).toHaveBeenCalledTimes(2);
    });

    it("keeps delivering to other handlers when one throws", async () => {
      const failure = new Error("Handler failed");
      const thrown: unknown[] = [];
      const onError = (error: unknown) => thrown.push(error);
      process.on("uncaughtException", onError);
      try {
        const jmap = client();
        const second = vi.fn<OnStateChangeHandler>();
        await jmap.onStateChange(() => {
          throw failure;
        });
        await jmap.onStateChange(second);

        emitOn(0, change);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(second).toHaveBeenCalledExactlyOnceWith(null, payload);
        expect(thrown).toEqual([failure]);
      } finally {
        process.off("uncaughtException", onError);
      }
    });

    it("uses the event stream when the transport's subscribe returns null", async () => {
      const subscribe = vi.fn<NonNullable<Transport["subscribe"]>>(() => null);
      const jmap = client(() => ({ send: vi.fn<Transport["send"]>(), subscribe }));
      const handler = vi.fn<OnStateChangeHandler>();

      await jmap.onStateChange(handler);
      emitOn(0, change);

      expect(subscribe).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledExactlyOnceWith(null, payload);
    });

    it("delivers the same payloads from the transport's push channel, subscribing once", async () => {
      let events: PushEvents | undefined;
      const unsubscribe = vi.fn<() => void>();
      const subscribe = vi.fn<NonNullable<Transport["subscribe"]>>((_, pushEvents) => {
        events = pushEvents;
        return { [Symbol.dispose]: unsubscribe };
      });
      const jmap = client(() => ({ send: vi.fn<Transport["send"]>(), subscribe }));
      const first = vi.fn<OnStateChangeHandler>();
      const second = vi.fn<OnStateChangeHandler>();

      const a = await jmap.onStateChange(first);
      const b = await jmap.onStateChange(second, { pingSeconds: 5 });
      events!.onStateChange(JSON.parse(change));
      const error = new StateChangeError("Dropped");
      events!.onError(error);

      expect(createEventSource).not.toHaveBeenCalled();
      expect(subscribe).toHaveBeenCalledOnce();
      expect(first.mock.calls).toEqual([
        [null, payload],
        [error, undefined],
      ]);
      expect(second.mock.calls).toEqual(first.mock.calls);

      a[Symbol.dispose]();
      expect(unsubscribe).not.toHaveBeenCalled();
      b[Symbol.dispose]();
      await vi.waitFor(() => expect(unsubscribe).toHaveBeenCalledOnce());
    });

    it("ends every subscription when the client is disposed", async () => {
      const jmap = client();
      const handler = vi.fn<OnStateChangeHandler>();
      await jmap.onStateChange(handler);
      await jmap.onStateChange(handler, { pingSeconds: 5 });

      jmap[Symbol.dispose]();

      await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(2));
      await expect(jmap.onStateChange(handler)).rejects.toBeInstanceOf(CancellationError);
    });
  });
});
