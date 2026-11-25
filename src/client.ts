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
import { getCapabilitiesForBuiltIns } from "./built-ins.ts";
import { CancellationError, ConfigurationError } from "./errors/index.ts";
import type { JsonMetaError } from "./errors/index.ts";
import { CapabilityIndex } from "./internal/capability-index.ts";
import { assertValidConfig } from "./internal/config.ts";
import { createApi } from "./internal/create-api.ts";
import type { DispatcherOptions } from "./internal/dispatcher.ts";
import { Dispatcher } from "./internal/dispatcher.ts";
import { addDisposeFallback, disposable, dispose } from "./internal/disposable.ts";
import type { DisposeFallback } from "./internal/disposable.ts";
import { openEventStream } from "./internal/event-stream.ts";
import { expandURITemplate } from "./internal/expand-uri-template.ts";
import { HttpClient } from "./internal/http.ts";
import { StateChangeHub } from "./internal/state-change-hub.ts";
import type { FileDownload, FileUpload } from "./rfc-types/core/index.ts";
import { httpTransport } from "./transports/http.ts";
import type { Transport, TransportContext } from "./transports/types.ts";
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

    this.#sessionUrl = options.sessionUrl;
    this.#http = new HttpClient(options.auth, options.hooks);
    this.#capabilities = new CapabilityIndex(getCapabilitiesForBuiltIns(options.capabilities));
    this.#generateMethodCallId = options.generateMethodCallId ?? defaultMethodCallId;
    this.#onWarning = options.onWarning ?? defaultOnWarning;

    // One transport per client, shared by every dispatcher
    const context: TransportContext = {
      authenticate: this.#http.authenticate,
      fetch: async (url, init) => (await this.#http.fetch(url, init)).response,
    };
    this.#transport = (options.transport ?? httpTransport())(context);
    this.#stateChanges = new StateChangeHub({
      transport: this.#transport,
      openEventStream: (session, events, pingSeconds) =>
        openEventStream(this.#http, session, events, pingSeconds),
      isPrimaryAccount: (session, entity, accountId) =>
        this.#capabilities.isPrimaryAccount(session, entity, accountId),
    });

    // Everything a dispatcher needs; each API gets its own dispatcher
    this.#dispatcherOptions = {
      transport: this.#transport,
      signal: this.#lifetime.signal,
      session: () => this.session,
      urnsForEntity: this.#capabilities.urnsForEntity,
      findMethodOwner: this.#capabilities.findMethodOwner,
      hooks: options.hooks,
    };

    // Initialize API proxy
    const dispatcher = new Dispatcher(this.#dispatcherOptions);
    this.api = this.#setupApi(dispatcher);
    this.cancelBatch = dispatcher.cancel;
    addDisposeFallback(this, this[Symbol.dispose]);

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
   * provided in the actual {@link ClientSession}; discrepancies are
   * passed to the `onWarning` option, which defaults to `console.warn`.
   */
  refreshSession = (): Promise<ClientSession<GivenCapabilities>> => {
    if (this.#lifetime.signal.aborted) {
      return Promise.reject(new CancellationError("The client was disposed"));
    }
    this.#session = this.#whileAlive(() =>
      this.#http.fetchJson<ClientSession<GivenCapabilities>>(this.#sessionUrl, {
        signal: this.#lifetime.signal,
      }),
    ).then((session) => {
      if (!this.#sessionLoaded) {
        this.#sessionLoaded = true;
        this.#validateSessionCapabilities(session);
      }
      return session;
    });

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
    upload: (body: BodyInit, params: FileUpload.Params): Promise<FileUpload.Result> =>
      this.#whileAlive(async () => {
        const session = await this.session;
        const url = expandURITemplate(session.uploadUrl, { accountId: params.accountId });
        return this.#http.fetchJson<FileUpload.Result>(url, {
          method: "POST",
          body,
          signal: this.#lifetime.signal,
        });
      }),
    /**
     * Download a blob from the given account
     */
    download: (params: FileDownload.Params): Promise<Response> =>
      this.#whileAlive(async () => {
        const session = await this.session;
        const url = expandURITemplate(session.downloadUrl, { ...params });
        const { response } = await this.#http.fetch(url, {
          method: "GET",
          signal: this.#lifetime.signal,
        });
        return response;
      }),
  };

  /**
   * Subscribe to state changes. Every handler shares one push channel: the
   * transport's, when it provides one, or else the session's event stream.
   */
  onStateChange = async (
    handler: OnStateChangeHandler,
    options: OnStateChangeOptions = {},
  ): Promise<Disposable & DisposeFallback> => {
    const { pingSeconds = 30, signal } = options;
    if (this.#lifetime.signal.aborted) {
      throw new CancellationError("The client was disposed");
    }
    const session = await this.session;
    if (signal?.aborted) {
      return disposable(() => {});
    }
    const subscription = await this.#stateChanges.add(session, handler, pingSeconds);
    // The signal may have aborted while the channel opened, when a listener
    // would never fire
    if (signal?.aborted) {
      dispose(subscription);
      return subscription;
    }
    signal?.addEventListener("abort", () => dispose(subscription), { once: true });
    return subscription;
  };

  /**
   * Release the client's connections: reject JMAP Requests, blob transfers
   * and session requests in flight with `CancellationError`, end every
   * `onStateChange` subscription, and dispose the transport. Later method
   * calls, blob transfers, session refreshes and `onStateChange` calls reject
   * with `CancellationError`. On a runtime without `Symbol.dispose`, this
   * method is named {@link JsonMetaClient.disconnect}.
   */
  [Symbol.dispose] = (): void => {
    if (this.#lifetime.signal.aborted) {
      return;
    }
    this.#lifetime.abort();
    this.#stateChanges.close();
    dispose(this.#transport);
  };

  /**
   * `[Symbol.dispose]()` on a runtime without `Symbol.dispose`, where it is
   * the method that releases the client's connections. Absent elsewhere.
   */
  declare readonly disconnect?: () => void;

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
   * Run an HTTP call that the client's disposal cancels: it rejects with
   * `CancellationError` once the client is disposed, whatever it failed with
   */
  async #whileAlive<T>(run: () => Promise<T>): Promise<T> {
    const { signal } = this.#lifetime;
    if (signal.aborted) {
      throw new CancellationError("The client was disposed");
    }
    try {
      return await run();
    } catch (error) {
      if (signal.aborted && !(error instanceof CancellationError)) {
        throw new CancellationError("The client was disposed", { cause: error });
      }
      throw error;
    }
  }

  /**
   * The URI for getting a JMAP session
   */
  readonly #sessionUrl: string | URL;

  /**
   * Makes every HTTP request, with authentication and the fetch hooks
   */
  readonly #http: HttpClient;

  /**
   * Carries every JMAP Request, and push messages when it supports them
   */
  readonly #transport: Transport;

  /**
   * Shares push channels between `onStateChange` handlers
   */
  readonly #stateChanges: StateChangeHub;

  /**
   * Aborted when the client is disposed
   */
  readonly #lifetime = new AbortController();

  /**
   * Lookups over the default and configured capabilities
   */
  readonly #capabilities: CapabilityIndex;

  readonly #generateMethodCallId: (method: string) => string;

  /**
   * Dependencies shared by the dispatcher of every API
   */
  readonly #dispatcherOptions: DispatcherOptions;

  /**
   * A reference to a promise that is used to access
   * the {@link ClientSession} synchronously
   */
  #session: Promise<ClientSession<GivenCapabilities>> | undefined;

  /**
   * Whether a session has loaded, and its capabilities been validated
   */
  #sessionLoaded = false;

  /**
   * Receives problems the client can work around
   */
  readonly #onWarning: (warning: JsonMetaError) => void;

  /**
   * Evaluates the capabilities configured in the client with
   * the actual capabilities exposed by the JMAP server
   * in its {@link ClientSession} object.
   *
   * Any of the configured capabilities that are found neither in
   * the session's capabilities nor in any account's capabilities
   * will be passed to `onWarning`. Some servers advertise a capability
   * only on the accounts that can use it.
   */
  #validateSessionCapabilities(session: ClientSession<GivenCapabilities>): void {
    const availableUrns = new Set([
      ...Object.keys(session.capabilities),
      ...Object.values(session.accounts ?? {}).flatMap((account) =>
        Object.keys(account.accountCapabilities ?? {}),
      ),
    ]);

    const configuredButNotAvailable = [...this.#capabilities.requestUrns].filter(
      (urn) => !availableUrns.has(urn),
    );
    if (configuredButNotAvailable.length > 0) {
      const error = new ConfigurationError(
        `json-meta-client was configured with capabilities that are NOT found in the current session: ${configuredButNotAvailable.join(", ")}`,
        {
          cause: {
            invalidCapabilities: configuredButNotAvailable,
          },
        },
      );
      this.#onWarning(error);
    }
  }

  /**
   * Initialize a dedicated api
   */
  #setupApi(dispatcher: Dispatcher): API {
    return createApi<API>({
      dispatcher,
      isKnownEntity: this.#capabilities.isKnownEntity,
      generateMethodCallId: this.#generateMethodCallId,
    });
  }
}

function defaultOnWarning(warning: JsonMetaError): void {
  console.warn(warning);
}

function defaultMethodCallId(method: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${method}::${hex}`;
}
