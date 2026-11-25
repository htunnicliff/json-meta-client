// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";

import { webSocketTransport } from "../../index.ts";
import type { OnStateChangeHandler } from "../../types.ts";
import { createClientWith, uniqueName } from "./client.ts";

const transport = webSocketTransport({
  createWebSocket: (url, protocols, headers) => new WebSocket(url, protocols, { headers }),
});

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
});
