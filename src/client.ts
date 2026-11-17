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
import { resolveDefaultAccount } from "./internal/default-account.ts";
import type { DispatcherOptions } from "./internal/dispatcher.ts";
import { Dispatcher } from "./internal/dispatcher.ts";
import { mapEntitiesToUrns } from "./internal/map-entities-to-urns.ts";
import type { FindMethodOwner } from "./internal/method-owners.ts";
import { mapMethodOwners } from "./internal/method-owners.ts";
import { replaceNestedResultRefKeys } from "./internal/middleware/replace-nested-result-ref-keys.ts";
import { readStateChanges } from "./internal/read-state-changes.ts";
import type { Middleware } from "./internal/types.ts";
import { createHttpError } from "./internal/util/create-http-error.ts";
import { encodeBasicCredentials } from "./internal/util/encode-basic-credentials.ts";
import { expandURITemplate } from "./internal/util/expand-uri-template.ts";
import { isReadableEventStream } from "./internal/util/is-readable-event-stream.ts";
import type {
  FileDownload,
  FileUpload,
  Response as JMAPResponse,
  Session,
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

    // The capability that gives each method call its default account
    const capabilities = [...DEFAULT_CAPABILITIES, ...this.#config.capabilities];
    this.#findMethodOwner = mapMethodOwners(capabilities);
    this.#configuredUrns = new Set(capabilities.map(({ urn }) => urn));

    // Built-in transformations of each method's arguments
    this.#middleware = [replaceNestedResultRefKeys];

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
      findMethodOwner: this.#findMethodOwner,
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
      (session) => {
        const isFirstLoad = !this.#sessionSync;
        this.#sessionSync = session;
        if (isFirstLoad) {
          this.#validateSessionCapabilities(session);
        }
        return session;
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
      return this.#fetchJson<FileUpload.Result>(url, { method: "POST", body });
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
    const url = expandURITemplate(session.eventSourceUrl, {
      types: "*",
      // spellchecker:disable-next-line
      closeafter: "no",
      ping: pingSeconds.toFixed(0),
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
          for (const change of readStateChanges(event.data)) {
            handler(null, {
              ...change,
              isPrimaryAccount: this.#isPrimaryAccount(session, change.entity, change.accountId),
            });
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
   * Finds the capability that gives a method call its default account
   */
  readonly #findMethodOwner: FindMethodOwner;

  /**
   * The URNs of the default and configured capabilities
   */
  readonly #configuredUrns: ReadonlySet<string>;

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
   * Any of the configured capabilities that are found neither in
   * the session's capabilities nor in any account's capabilities
   * will be logged as a warning. Some servers advertise a capability
   * only on the accounts that can use it.
   */
  #validateSessionCapabilities(session: ClientSession<GivenCapabilities>): void {
    const configuredUrns = new Set(Object.values(this.#entityToUrn).flat());
    const availableUrns = new Set([
      ...Object.keys(session.capabilities),
      ...Object.values(session.accounts ?? {}).flatMap((account) =>
        Object.keys(account.accountCapabilities ?? {}),
      ),
    ]);

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
   * Whether an `Entity/get` call that passes no `accountId` would go to the
   * account, by the same resolution as method calls. Such a call has no
   * default account when no capability owns it, as with push-only types
   * like `EmailDelivery`; the account then counts as primary if it is the
   * primary account of any configured capability, or the session's only
   * account.
   */
  #isPrimaryAccount(session: Session, entity: string, accountId: string): boolean {
    const account = resolveDefaultAccount(this.#findMethodOwner(`${entity}/get`), session);
    switch (account.status) {
      case "resolved": {
        return account.accountId === accountId;
      }
      case "none": {
        const accountIds = Object.keys(session.accounts ?? {});
        return (
          [...this.#configuredUrns].some((urn) => session.primaryAccounts[urn] === accountId) ||
          (accountIds.length === 1 && accountIds[0] === accountId)
        );
      }
      default: {
        return false;
      }
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
   * Primary fetch function: authenticates the request, runs the fetch hooks,
   * and rejects responses that aren't successful
   */
  #fetch = async (url: string | URL, options: RequestInit = {}, eventSource = false) => {
    const hooks = this.#config.hooks ?? {};
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
   * Apply the configured authentication to a request
   */
  async #authenticate(request: Request): Promise<void> {
    const auth = this.#config.auth;
    if (typeof auth === "function") {
      await auth({ request });
    } else if (typeof auth === "string") {
      request.headers.set("authorization", `Bearer ${auth}`);
    } else {
      request.headers.set("authorization", `Basic ${encodeBasicCredentials(auth)}`);
    }
  }

  /**
   * Primary fetch function for responses expected to return JSON
   */
  #fetchJson = async <T>(url: string | URL, options: RequestInit = {}): Promise<T> => {
    const headers = new Headers(options.headers);
    headers.append("accept", "application/json");
    const { request, response } = await this.#fetch(url, { ...options, headers });
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
