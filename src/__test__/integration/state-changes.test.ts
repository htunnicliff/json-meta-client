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

import type { OnStateChangeHandler } from "../../index.ts";
import { createClientWith, uniqueName } from "./client.ts";

describe("state changes", () => {
  it("delivers a Mailbox change from the server's event stream", async () => {
    const connected = Promise.withResolvers<void>();
    const client = createClientWith(
      { hooks: { afterEventSourceConnect: [() => connected.resolve()] } },
      "mail",
    );
    const session = await client.session;
    const accountId = session.primaryAccounts["urn:ietf:params:jmap:mail"]!;
    const handler = vi.fn<OnStateChangeHandler>();
    const controller = new AbortController();

    try {
      await client.onStateChange(handler, { signal: controller.signal });
      await connected.promise;

      const { newState } = await client.api.Mailbox.set({
        create: { box: { name: uniqueName("State change") } },
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
    } finally {
      controller.abort();
    }
  });
});
