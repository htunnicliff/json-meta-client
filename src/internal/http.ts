// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { HttpError, JsonMetaError, NetworkError } from "../errors/index.ts";
import type { ProblemDetails } from "../rfc-types/core/index.ts";
import type { Auth, CapabilityOption, Config } from "../types.ts";

type Hooks = NonNullable<Config<ReadonlyArray<CapabilityOption>>["hooks"]>;

/**
 * Makes the client's HTTP requests: authenticates each one, runs the fetch
 * hooks, and rejects responses that aren't successful
 */
export class HttpClient {
  constructor(auth: Auth, hooks: Hooks = {}) {
    this.#auth = auth;
    this.#hooks = hooks;
  }

  readonly #auth: Auth;
  readonly #hooks: Hooks;

  /**
   * Fetch a URL. An event-source connection also runs the event-source hooks
   * and must answer with a readable event stream.
   */
  fetch = async (
    url: string | URL,
    options: RequestInit = {},
    eventSource = false,
  ): Promise<{ request: Request; response: Response }> => {
    const hooks = this.#hooks;
    let request: Request | undefined;
    let requestClone: Request;
    let response: Response;
    try {
      request = new Request(url, options);
      await this.#authenticate(request);
      const beforeHooks = [
        ...(hooks.beforeFetch ?? []),
        ...(eventSource ? (hooks.beforeEventSourceConnect ?? []) : []),
      ];
      for (const hook of beforeHooks) {
        // oxlint-disable-next-line no-await-in-loop
        request = await hook({ request });
      }
      requestClone = request.clone();
      response = await fetch(request);
    } catch (error) {
      if (error instanceof JsonMetaError) {
        throw error;
      }

      throw new NetworkError(error instanceof Error ? error.message : "Error when fetching", {
        cause: error,
        request,
      });
    }
    try {
      for (const hook of hooks.afterFetch ?? []) {
        // oxlint-disable-next-line no-await-in-loop
        response = await hook({ request: requestClone, response });
      }
      if (eventSource && response.status !== 204) {
        if (!isReadableEventStream(response)) {
          throw new HttpError("Invalid event-stream response", { request, response });
        }
        for (const hook of hooks.afterEventSourceConnect ?? []) {
          // oxlint-disable-next-line no-await-in-loop
          await hook({ request: requestClone, response });
        }
      }
      if (!response.ok) {
        throw await createHttpError(request, response);
      }

      return { request, response };
    } catch (error) {
      // Nothing will read a failed event stream, so release its connection
      if (eventSource && response.body && !response.body.locked) {
        void response.body.cancel().catch(() => {});
      }
      throw error;
    }
  };

  /**
   * Fetch a URL whose response is expected to be JSON
   */
  fetchJson = async <T>(url: string | URL, options: RequestInit = {}): Promise<T> => {
    const headers = new Headers(options.headers);
    headers.append("accept", "application/json");
    const { request, response } = await this.fetch(url, { ...options, headers });
    let text: string;
    try {
      text = await response.text();
    } catch (cause) {
      throw new NetworkError("Failed to read", { cause, request });
    }
    const payload: T = JSON.parse(text);
    return payload;
  };

  /**
   * Apply the configured authentication to a request
   */
  async #authenticate(request: Request): Promise<void> {
    const auth = this.#auth;
    if (typeof auth === "function") {
      await auth({ request });
    } else if (typeof auth === "string") {
      request.headers.set("authorization", `Bearer ${auth}`);
    } else {
      request.headers.set("authorization", `Basic ${encodeBasicCredentials(auth)}`);
    }
  }
}

/**
 * Base64-encode a username and password for Basic authentication, as UTF-8
 */
function encodeBasicCredentials(auth: { username: string; password: string }): string {
  const bytes = new TextEncoder().encode(`${auth.username}:${auth.password}`);
  return btoa(Array.from(bytes, (byte) => String.fromCodePoint(byte)).join(""));
}

/**
 * Whether a response is an event stream whose body is still unread
 */
function isReadableEventStream(response: Response): boolean {
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim();
  return (
    response.status === 200 &&
    contentType?.toLowerCase() === "text/event-stream" &&
    response.body !== null &&
    !response.bodyUsed &&
    !response.body.locked
  );
}

/**
 * Describe an unsuccessful response, reading its body for the error's details
 */
async function createHttpError(request: Request, response: Response): Promise<HttpError> {
  let responseData: unknown;
  let cause: unknown;
  try {
    const isJsonResponse = /\bjson\b/i.test(response.headers.get("content-type") ?? "");
    responseData = isJsonResponse ? await response.clone().json() : await response.clone().text();
  } catch (error) {
    cause = error;
  }

  const message =
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    (responseData as ProblemDetails)?.detail ?? `HTTP request failed (${response.status})`;
  return new HttpError(message, { request, response, responseData, cause });
}
