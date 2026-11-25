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
      if (signal.aborted) {
        throw new CancellationError("The request was cancelled");
      }
      const init: RequestInit = {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(request),
        signal,
      };
      // For errors: the request as built here, before auth and hooks
      const httpRequest = new Request(session.apiUrl, init);
      let response: Response;
      try {
        response = await context.fetch(session.apiUrl, init);
      } catch (error) {
        if (signal.aborted) {
          throw new CancellationError("The request was cancelled", { cause: error });
        }
        throw error;
      }
      let text: string;
      try {
        text = await response.text();
      } catch (cause) {
        if (signal.aborted) {
          throw new CancellationError("The request was cancelled", { cause });
        }
        throw new NetworkError("Failed to read", { cause, request: httpRequest });
      }
      try {
        const payload: JmapResponse = JSON.parse(text);
        return payload;
      } catch (cause) {
        throw new NetworkError("The server's JMAP Response is not valid JSON", {
          cause,
          request: httpRequest,
        });
      }
    },
  });
}
