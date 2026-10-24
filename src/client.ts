import type {
  BlobDownloadParams,
  BlobUploadParams,
  BlobUploadResponse,
  EventSourceArguments,
  Request as JMAPRequest,
  Response as JMAPResponse,
  ProblemDetails,
  Session,
  StateChange,
} from "jmap-rfc-types";
import type { SetOptional, SetRequired } from "type-fest";

import type { DefaultCapabilities } from "./built-ins.ts";
import { DEFAULT_CAPABILITIES, getCapabilitiesForBuiltIns } from "./built-ins.ts";
import { mail } from "./capabilities/mail.ts";
import type { Capability } from "./capability.ts";
import {
  ConfigurationError,
  HttpError,
  JmapError,
  JsonMetaError,
  MethodCallError,
  NetworkError,
  StateChangeError,
} from "./errors.ts";
import type { Flush } from "./internal/batch.ts";
import { assertValidConfig } from "./internal/config.ts";
import { createApi } from "./internal/create-api.ts";
import { expandURITemplate } from "./internal/expand-uri-template.ts";
import { mapEntitiesToUrns } from "./internal/map-entities-to-urns.ts";
import { MethodCallResult } from "./internal/method-call-result.ts";
import type { MethodCall } from "./internal/method-call.ts";
import { injectAccountId } from "./internal/middleware/inject-account-id.ts";
import { replaceNestedResultRefKeys } from "./internal/middleware/replace-nested-result-ref-keys.ts";
import type {
  CapabilityOption,
  ClientApi,
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
      bearerToken: options.bearerToken,
      sessionUrl: options.sessionUrl,
      capabilities: getCapabilitiesForBuiltIns(options.capabilities),
      hooks: options.hooks,
      middleware: [
        replaceNestedResultRefKeys,
        injectAccountId(() => {
          if (!this.#sessionSync) throw new ConfigurationError("Session not yet resolved");
          return this.#sessionSync;
        }),
        ...(options.middleware ?? []),
      ],
    };

    // Build entity <-> URN map
    this.#entityToUrn = mapEntitiesToUrns(this.#config.capabilities);

    // Initialize API proxy
    const controller = new AbortController();
    this.api = this.#setupApi(controller);
    this.cancelBatch = () => controller.abort();

    // Lock it down
    Object.freeze(this);
  }

  /**
   * The initialized API proxy
   */
  readonly api: API;

  /**
   * Get the {@link Session} from cache, falling back to a fresh session
   */
  get session(): Promise<Session> {
    return this.#session ?? this.refreshSession();
  }

  /**
   * Retrieve and cache a new {@link Session}.
   *
   * Upon loading the session for the first time, the client
   * capabilities will be evaluated against the capabilities
   * provided in the actual {@link Session}; discrepancies will
   * result in a logged warning.
   */
  refreshSession = (): Promise<Session> => {
    this.#session = this.#fetchJson<Session>(this.#config.sessionUrl).then((result) => {
      const isFirstLoad = !this.#sessionSync;
      this.#sessionSync = result;
      if (isFirstLoad) {
        this.#validateSessionCapabilities(this.#sessionSync);
      }
      return result;
    });

    return this.#session;
  };

  blob = {
    /**
     * Upload a blob
     */
    upload: async (
      body: BodyInit,
      params: SetOptional<BlobUploadParams, "accountId"> = {},
    ): Promise<BlobUploadResponse> => {
      const session = await this.session;
      const url = expandURITemplate(session.uploadUrl, {
        accountId: params.accountId ?? session.primaryAccounts[mail.urn]!,
      });
      const data = await this.#fetchJson<BlobUploadResponse>(url, {
        method: "POST",
        body,
      });
      return data;
    },
    /**
     * Download a blob
     */
    download: async (params: SetOptional<BlobDownloadParams, "accountId">): Promise<Response> => {
      const session = await this.session;
      const url = expandURITemplate(session.downloadUrl, {
        ...params,
        accountId: params.accountId ?? session.primaryAccounts[mail.urn]!,
      });
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
    const url = expandURITemplate(session.eventSourceUrl, {
      types: "*",
      // spellchecker:disable-next-line
      closeafter: "no",
      ping: pingSeconds.toFixed(0),
    } satisfies EventSourceArguments);
    const { createEventSource } = await import("eventsource-client");

    const eventSource = createEventSource({
      url,
      headers: {
        authorization: `Bearer ${this.#config.bearerToken}`,
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
   * Create an isolated API instance with a separate batch queue for JMAP requests
   */
  isolated = <R>(fn: (api: API, cancel: () => void) => R): R => {
    const controller = new AbortController();
    const api = this.#setupApi(controller);
    const cancel = () => controller.abort();
    return fn(api, cancel);
  };

  // ------------------- Internals -------------------

  /**
   * Parameters used to initialize the client
   */
  readonly #config: SetRequired<Config<ReadonlyArray<Capability>>, "middleware">;

  /**
   * A mapping of every entity name to their respective capability URNs
   */
  readonly #entityToUrn: Record<string, string[]>;

  /**
   * A reference to a promise that is used to access
   * the {@link Session} synchronously
   */
  #session: Promise<Session> | undefined;

  /**
   * The {@link Session} received from the session URI
   */
  #sessionSync: Session | undefined;

  /**
   * Evaluates the capabilities configured in the client with
   * the actual capabilities exposed by the JMAP server
   * in its {@link Session} object.
   *
   * Any of the configured capabilities that are not found in
   * the session will be logged as a warning
   */
  #validateSessionCapabilities(session: Session): void {
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
  #setupApi({ signal }: { signal: AbortSignal }): API {
    return createApi<API>({
      processMethodCalls: this.#processQueuedMethodCalls,
      middleware: this.#config.middleware,
      signal,
    });
  }

  /**
   * The primary "flush" function that processes pending batch jobs
   */
  #processQueuedMethodCalls: Flush<MethodCall<unknown>> = async (jobs) => {
    try {
      const methodCalls = jobs.map((b) => b.payload);

      const urnsToUse = new Set<string>();

      for (const { urn } of DEFAULT_CAPABILITIES) {
        urnsToUse.add(urn);
      }

      for (const { method } of methodCalls) {
        const [entity] = /^[^/]+/.exec(method)!;
        for (const urn of this.#entityToUrn[entity] ?? []) {
          urnsToUse.add(urn);
        }
      }

      const request: JMAPRequest = {
        using: [...urnsToUse],
        methodCalls: methodCalls.map((c) => c.toInvocation()),
      };

      const response = await this.#fetchJson<JMAPResponse>((await this.session).apiUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });

      const resultsById = new Map<string, MethodCallResult<unknown>[]>();
      for (const invocation of response.methodResponses) {
        const result = new MethodCallResult(invocation);
        const results = resultsById.get(result.id);
        if (results) {
          results.push(result);
        } else {
          resultsById.set(result.id, [result]);
        }
      }

      for (const { payload: methodCall, handle } of jobs) {
        const results = resultsById.get(methodCall.id);
        const result =
          results?.find(
            (result) => result.method === methodCall.method || result.method === "error",
          ) ?? results?.[0];
        if (!result) {
          handle.reject(
            new MethodCallError(`No response for method call "${methodCall.id}"`, { methodCall }),
          );
          continue;
        }

        const { data } = result;
        if (result.method !== "error" && result.method !== methodCall.method) {
          handle.reject(
            new MethodCallError(
              `Unexpected response method "${result.method}" for "${methodCall.method}"`,
              {
                methodCall,
                responseData: data,
              },
            ),
          );
          continue;
        }
        if (result.method === "error") {
          handle.reject(
            JmapError.isProblemDetails(data)
              ? new JmapError("Error in method call", data, { methodCall })
              : new MethodCallError("Unknown error in method call", {
                  methodCall,
                  responseData: data,
                }),
          );
        } else {
          handle.resolve(data);
        }
      }
    } catch (error) {
      for (const { handle } of jobs) {
        handle.reject(error);
      }
    }
  };

  /**
   * Primary fetch function
   */
  #fetch = async (url: string | URL, options: RequestInit = {}) => {
    let request: Request | undefined;
    let requestClone: Request | undefined;
    let response: Response;
    try {
      const headers = new Headers(options.headers);
      headers.set("authorization", `Bearer ${this.#config.bearerToken}`);
      request = new Request(url, { ...options, headers });
      for (const hook of this.#config.hooks?.beforeRequest ?? []) {
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
    for (const hook of this.#config.hooks?.afterResponse ?? []) {
      // oxlint-disable-next-line no-await-in-loop
      response = await hook({ request: requestClone, response });
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
