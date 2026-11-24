// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { CancellationError, NetworkError } from "../errors/index.ts";
import type { Response as JmapResponse } from "../rfc-types/core/index.ts";
import type { TransportFactory } from "./types.ts";

/**
 * Send each JMAP Request as an HTTP POST to the session's `apiUrl`. State
 * changes come from the event stream. This is the client's default transport.
 */
export function httpTransport(): TransportFactory {
  return (context) => ({
    send: async (request, { session, signal }) => {
      if (signal.aborted) throw new CancellationError("The client was disposed");
      let response: Response;
      try {
        response = await context.fetch(session.apiUrl, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(request),
          signal,
        });
      } catch (error) {
        if (signal.aborted)
          throw new CancellationError("The client was disposed", { cause: error });
        throw error;
      }
      let text: string;
      try {
        text = await response.text();
      } catch (cause) {
        if (signal.aborted) throw new CancellationError("The client was disposed", { cause });
        throw new NetworkError("Failed to read", { cause, request: undefined });
      }
      const payload: JmapResponse = JSON.parse(text);
      return payload;
    },
  });
}
