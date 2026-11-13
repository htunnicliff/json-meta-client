// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { DefaultCapabilities } from "./built-ins.ts";
import { DEFAULT_CAPABILITIES, getCapabilitiesForBuiltIns } from "./built-ins.ts";
import { mail } from "./capabilities/mail.ts";
import type { Capability } from "./capability.ts";
import {
  ConfigurationError,
  HttpError,
  JsonMetaError,
  NetworkError,
  StateChangeError,
} from "./errors.ts";
import { assertValidConfig } from "./internal/config.ts";
import { createApi } from "./internal/create-api.ts";
import { Dispatcher } from "./internal/dispatcher.ts";
import type { DispatcherOptions } from "./internal/dispatcher.ts";
import { expandURITemplate } from "./internal/expand-uri-template.ts";
import { mapEntitiesToUrns } from "./internal/map-entities-to-urns.ts";
import { injectAccountId } from "./internal/middleware/inject-account-id.ts";
import { replaceNestedResultRefKeys } from "./internal/middleware/replace-nested-result-ref-keys.ts";
import type { Middleware } from "./internal/types.ts";
import type {
  FileDownload,
  FileUpload,
  EventSourceArguments,
  Response as JMAPResponse,
  ProblemDetails,
  StateChange,
} from "./rfc-types/core/index.ts";
import type {
  CapabilityOption,
  ClientApi,
  ClientSession,
  Config,
  OnStateChangeHandler,
  OnStateChangeOptions,
} from "./types.ts";

export class JsonMetaClient<
  const GivenCapabilities extends ReadonlyArray<CapabilityOption>,
  API extends ClientApi<GivenCapabilities> & ClientApi<DefaultCapabilities>,
> {
  constructor(options: Config<GivenCapabilities>) {
    assertValidConfig(options);

    // Assemble config
    this.#config = {
      auth: options.auth,
      sessionUrl: options.sessionUrl,
      capabilities: getCapabilitiesForBuiltIns(options.capabilities),
      hooks: options.hooks,
    };

    // Built-in transformations of each method's arguments
    this.#middleware = [
      replaceNestedResultRefKeys,
      injectAccountId(() => {
        if (!this.#sessionSync) throw new ConfigurationError("Session not yet resolved");
        return this.#sessionSync;
      }),
    ];

    // Build entity <-> URN map
    this.#entityToUrn = mapEntitiesToUrns(this.#config.capabilities);

    // Default capabilities are always included, so their entities are always known
    this.#knownEntities = new Set([
      ...Object.keys(this.#entityToUrn),
      ...DEFAULT_CAPABILITIES.flatMap((capability) => capability.entities),
    ]);

    // Everything a dispatcher needs; each API gets its own dispatcher
    this.#dispatcherOptions = {
      transport: this.#postJmapRequest,
      session: () => this.session,
      urnsForEntity: (entity) => this.#entityToUrn[entity] ?? [],
      hooks: this.#config.hooks,
    };

    // Initialize API proxy
    const dispatcher = new Dispatcher(this.#dispatcherOptions);
    this.api = this.#setupApi(dispatcher);
    this.cancelBatch = dispatcher.cancel;

    // Lock it down
    Object.freeze(this);
  }

  /**
   * The initialized API proxy
   */
  readonly api: API;

  /**
   * Get the {@link ClientSession} from cache, falling back to a fresh session
   */
  get session(): Promise<ClientSession<GivenCapabilities>> {
    return this.#session ?? this.refreshSession();
  }

  /**
   * Retrieve and cache a new {@link ClientSession}.
   *
   * Upon loading the session for the first time, the client
   * capabilities will be evaluated against the capabilities
   * provided in the actual {@link ClientSession}; discrepancies will
   * result in a logged warning.
   */
  refreshSession = (): Promise<ClientSession<GivenCapabilities>> => {
    this.#session = this.#fetchJson<ClientSession<GivenCapabilities>>(this.#config.sessionUrl).then(
      (result) => {
        const isFirstLoad = !this.#sessionSync;
        this.#sessionSync = result;
        if (isFirstLoad) {
          this.#validateSessionCapabilities(this.#sessionSync);
        }
        return result;
      },
    );

    return this.#session;
  };

  /**
   * Upload and download blobs. Each call names its account: the client does
   * not choose a default, because the right one depends on what the blob is
   * for.
   */
  blob = {
    /**
     * Upload a blob to the given account
     */
    upload: async (body: BodyInit, params: FileUpload.Params): Promise<FileUpload.Result> => {
      const session = await this.session;
      const url = expandURITemplate(session.uploadUrl, { accountId: params.accountId });
      const data = await this.#fetchJson<FileUpload.Result>(url, {
        method: "POST",
        body,
      });
      return data;
    },
    /**
     * Download a blob from the given account
     */
    download: async (params: FileDownload.Params): Promise<Response> => {
      const session = await this.session;
      const url = expandURITemplate(session.downloadUrl, { ...params });
      const { response } = await this.#fetch(url, { method: "GET" });
      return response;
    },
  };

  /**
   * Subscribe to state changes
   */
  onStateChange = async (
    handler: OnStateChangeHandler,
    options: OnStateChangeOptions = {},
  ): Promise<Disposable> => {
    const { pingSeconds = 30, signal } = options;
    const session = await this.session;
    const primaryAccountId = session.primaryAccounts[mail.urn]!;
    const eventSourceArguments: EventSourceArguments = {
      types: "*",
      // spellchecker:disable-next-line
      closeafter: "no",
      ping: pingSeconds,
    };
    const url = expandURITemplate(session.eventSourceUrl, {
      ...eventSourceArguments,
      ping: eventSourceArguments.ping.toFixed(0),
    });
    const { createEventSource } = await import("eventsource-client");

    const eventSource = createEventSource({
      url,
      fetch: async (url, options) => {
        const requestOptions: RequestInit = options ?? {};
        try {
          return (await this.#fetch(url, requestOptions, true)).response;
        } catch (cause) {
          if (!requestOptions.signal?.aborted) {
            handler(new StateChangeError("Event-stream connection failed", { cause }), undefined);
          }
          throw cause;
        }
      },
      onMessage: (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload["@type"] !== "StateChange") {
            return;
          }
          // oxlint-disable typescript/no-unsafe-type-assertion
          const { changed } = payload as StateChange;
          for (const [accountId, changes] of Object.entries(changed)) {
            for (const [entity, state] of Object.entries(changes)) {
              handler(null, {
                entity,
                state,
                accountId,
                isPrimaryAccount: accountId === primaryAccountId,
              });
            }
          }
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : `An error occurred when parsing a state change message payload`;
          handler(new StateChangeError(message, { cause: error }), undefined);
        }
      },
    });
    signal?.addEventListener("abort", () => eventSource.close());
    return {
      [Symbol.dispose ?? "disconnect"]: () => eventSource.close(),
    };
  };

  /**
   * Clear pending JMAP requests
   */
  readonly cancelBatch: () => void;

  /**
   * Create an isolated API instance with a separate batch for JMAP requests
   */
  isolated = <R>(fn: (api: API, cancel: () => void) => R): R => {
    const dispatcher = new Dispatcher(this.#dispatcherOptions);
    return fn(this.#setupApi(dispatcher), dispatcher.cancel);
  };

  // ------------------- Internals -------------------

  /**
   * Parameters used to initialize the client
   */
  readonly #config: Config<ReadonlyArray<Capability>>;

  /**
   * Transformations applied to each method's arguments
   */
  readonly #middleware: ReadonlyArray<Middleware>;

  /**
   * Dependencies shared by the dispatcher of every API
   */
  readonly #dispatcherOptions: DispatcherOptions;

  /**
   * A mapping of every entity name to their respective capability URNs
   */
  readonly #entityToUrn: Record<string, string[]>;

  /**
   * Entities declared by a configured or default capability
   */
  readonly #knownEntities: ReadonlySet<string>;

  /**
   * A reference to a promise that is used to access
   * the {@link ClientSession} synchronously
   */
  #session: Promise<ClientSession<GivenCapabilities>> | undefined;

  /**
   * The {@link ClientSession} received from the session URI
   */
  #sessionSync: ClientSession<GivenCapabilities> | undefined;

  /**
   * Evaluates the capabilities configured in the client with
   * the actual capabilities exposed by the JMAP server
   * in its {@link ClientSession} object.
   *
   * Any of the configured capabilities that are not found in
   * the session will be logged as a warning
   */
  #validateSessionCapabilities(session: ClientSession<GivenCapabilities>): void {
    const configuredUrns = new Set(Object.values(this.#entityToUrn).flat());
    const availableUrns = new Set(Object.keys(session.capabilities));

    const configuredButNotAvailable = [...configuredUrns].filter((urn) => !availableUrns.has(urn));
    if (configuredButNotAvailable.length > 0) {
      const error = new ConfigurationError(
        `json-meta-client was configured with capabilities that are NOT found in the current session: ${configuredButNotAvailable.join(", ")}`,
        {
          cause: {
            invalidCapabilities: configuredButNotAvailable,
          },
        },
      );
      console.warn(error);
    }
  }

  /**
   * Initialize a dedicated api
   */
  #setupApi(dispatcher: Dispatcher): API {
    return createApi<API>({
      dispatcher,
      middleware: this.#middleware,
      isKnownEntity: (entity) => this.#knownEntities.has(entity),
    });
  }

  /**
   * Transport that posts a JMAP Request to the session's API URL
   */
  #postJmapRequest: DispatcherOptions["transport"] = (request, session) =>
    this.#fetchJson<JMAPResponse>(session.apiUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });

  /**
   * Primary fetch function
   */
  #fetch = async (url: string | URL, options: RequestInit = {}, eventSource = false) => {
    let request: Request | undefined;
    let requestClone: Request | undefined;
    let response: Response;
    try {
      request = new Request(url, options);
      const auth = this.#config.auth;
      if (typeof auth === "function") {
        await auth({ request });
      } else if (typeof auth === "string") {
        request.headers.set("authorization", `Bearer ${auth}`);
      } else {
        const bytes = new TextEncoder().encode(`${auth.username}:${auth.password}`);
        const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
        const encoded = btoa(binString);
        request.headers.set("authorization", `Basic ${encoded}`);
      }
      for (const hook of [
        ...(this.#config.hooks?.beforeFetch ?? []),
        ...(eventSource ? (this.#config.hooks?.beforeEventSourceConnect ?? []) : []),
      ]) {
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
      for (const hook of this.#config.hooks?.afterFetch ?? []) {
        // oxlint-disable-next-line no-await-in-loop
        response = await hook({ request: requestClone, response });
      }
      if (eventSource && response.status !== 204) {
        const contentType = response.headers.get("content-type")?.split(";")[0]?.trim();
        if (
          response.status !== 200 ||
          contentType?.toLowerCase() !== "text/event-stream" ||
          !response.body ||
          response.bodyUsed ||
          response.body.locked
        ) {
          throw new HttpError("Invalid event-stream response", { request, response });
        }
        for (const hook of this.#config.hooks?.afterEventSourceConnect ?? []) {
          // oxlint-disable-next-line no-await-in-loop
          await hook({ request: requestClone, response });
        }
      }
      if (!response.ok) {
        let responseData: unknown;
        let cause: unknown;
        try {
          const isJsonResponse = /\bjson\b/i.test(response.headers.get("content-type") ?? "");
          responseData = isJsonResponse
            ? await response.clone().json()
            : await response.clone().text();
        } catch (error) {
          cause = error;
        }

        const message =
          (responseData as ProblemDetails)?.detail ?? `HTTP request failed (${response.status})`;
        throw new HttpError(message, { request, response, responseData, cause });
      }

      return { request, response };
    } catch (error) {
      if (eventSource && response.body && !response.body.locked) {
        void response.body.cancel().catch(() => {});
      }
      throw error;
    }
  };

  /**
   * Primary fetch function for responses expected to return JSON
   */
  #fetchJson = async <T>(url: string | URL, options: RequestInit = {}): Promise<T> => {
    const headers = new Headers(options.headers);
    headers.append("accept", "application/json");
    const { request, response } = await this.#fetch(url, {
      ...options,
      headers,
    });
    let text: string;
    try {
      text = await response.text();
    } catch (cause) {
      throw new NetworkError("Failed to read", { cause, request });
    }
    const payload: T = JSON.parse(text);
    return payload;
  };
}
