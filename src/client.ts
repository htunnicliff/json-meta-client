// oxlint-disable typescript/no-unsafe-type-assertion
import type {
  BlobDownloadParams,
  BlobUploadParams,
  BlobUploadResponse,
  EventSourceArguments,
  Request as JMAPRequest,
  Response as JMAPResponse,
  Session,
  StateChange,
} from "jmap-rfc-types";
import type { SetOptional, UnionToIntersection } from "type-fest";

import { createApi } from "./api.ts";
import { core } from "./capabilities/core.ts";
import { mail } from "./capabilities/mail.ts";
import type { Augment, Capability, InferMethodsFromCapability } from "./capability.ts";
import {
  JmapConfigurationError,
  JmapError,
  JmapHttpError,
  JmapProtocolError,
  JmapTransportError,
  type JmapRequestContext,
} from "./error.ts";
import type { Flush } from "./internal/batch.ts";
import { expandURITemplate } from "./internal/expand-uri-template.ts";
import { mapEntitiesToUrns } from "./internal/map-entities-to-urns.ts";
import { MethodCall, MethodCallResult } from "./internal/method-calls.ts";
import { injectAccountId } from "./internal/middleware/inject-account-id.ts";
import { replaceNestedResultRefKeys } from "./internal/middleware/replace-nested-result-ref-keys.ts";
import type { Middleware } from "./internal/types.ts";

export const DEFAULT_CAPABILITIES = [core];

type ClientApi<T extends ReadonlyArray<Capability>> = T[number] extends never
  ? object
  : Augment<UnionToIntersection<InferMethodsFromCapability<T[number]>>>;

export interface Config<T extends ReadonlyArray<Capability>> {
  bearerToken: string;
  sessionUrl: string | URL;
  capabilities: T;
  logger?: Pick<typeof console, "error" | "warn" | "info" | "debug">;
  middleware?: ReadonlyArray<Middleware>;
}

export class Client<
  T extends ReadonlyArray<Capability>,
  API extends ClientApi<T> & ClientApi<typeof DEFAULT_CAPABILITIES>,
> {
  readonly #config: Required<Config<T>>;

  readonly #entityToUrn: Record<string, string[]>;

  readonly api: API;

  #sessionPromise: Promise<Session> | undefined;

  #session: Session | undefined;

  constructor(options: Config<T>) {
    if (!options || typeof options !== "object")
      throw new JmapConfigurationError("Client options must be an object");
    Client.#validateOptions(options);

    this.#config = {
      bearerToken: options.bearerToken,
      sessionUrl: options.sessionUrl,
      capabilities: options.capabilities,
      logger: options.logger ?? console,
      middleware: [
        replaceNestedResultRefKeys,
        injectAccountId(() => {
          if (!this.#session) throw new JmapConfigurationError("Session not yet resolved");
          return this.#session;
        }),
        ...(options.middleware ?? []),
      ],
    };

    try {
      this.#entityToUrn = mapEntitiesToUrns(this.#config.capabilities);
    } catch (cause) {
      throw new JmapConfigurationError("Invalid capability configuration", { cause });
    }

    this.api = createApi<API>(this.#processQueuedMethodCalls, this.#config.middleware);

    Object.freeze(this);
  }

  get #logger() {
    return this.#config.logger;
  }

  get session(): Promise<Session> {
    return this.#sessionPromise ?? this.refreshSession();
  }

  refreshSession = (): Promise<Session> => {
    this.#sessionPromise = this.#fetchJson<Session>(this.#config.sessionUrl).then((result) => {
      if (
        !isRecord(result) ||
        typeof result.apiUrl !== "string" ||
        !URL.canParse(result.apiUrl) ||
        !isRecord(result.capabilities) ||
        !isRecord(result.primaryAccounts)
      ) {
        throw new JmapProtocolError("Invalid JMAP session", {
          request: { url: String(this.#config.sessionUrl), method: "GET" },
          payload: result,
        });
      }
      const isFirstLoad = !this.#session;
      this.#session = result;
      if (isFirstLoad) {
        this.#validateSessionCapabilities(this.#session);
      }
      return result;
    });

    return this.#sessionPromise;
  };

  #validateSessionCapabilities(session: Session): void {
    const configuredUrns = new Set(Object.values(this.#entityToUrn).flat());
    const availableUrns = new Set(Object.keys(session.capabilities));

    const configuredButNotAvailable = [...configuredUrns].filter((urn) => !availableUrns.has(urn));
    if (configuredButNotAvailable.length > 0) {
      const error = new JmapConfigurationError(
        `json-meta-client was configured with capabilities that are NOT found in the current session: ${configuredButNotAvailable.join(", ")}`,
      );
      this.#logger.warn(error);
    }
  }

  static #validateOptions(options: Config<ReadonlyArray<Capability>>): void {
    if (typeof options.bearerToken !== "string" || options.bearerToken.trim().length === 0) {
      throw new JmapConfigurationError("`bearerToken` must be a non-empty string");
    }

    if (!URL.canParse(options.sessionUrl)) {
      throw new JmapConfigurationError("`sessionUrl` must be a valid URL string or URL instance", {
        cause: options.sessionUrl,
      });
    }

    if (!Array.isArray(options.capabilities)) {
      throw new JmapConfigurationError("`capabilities` must be an array");
    }
    for (const capability of options.capabilities) {
      if (!capability || typeof capability.urn !== "string") {
        throw new JmapConfigurationError("Capabilities must have a `urn`", { cause: capability });
      }
      if (
        !Array.isArray(capability.entities) ||
        !capability.entities.every((entity: unknown) => typeof entity === "string")
      ) {
        throw new JmapConfigurationError(
          "Capability entries must be an array of entity name strings",
        );
      }
    }

    if (options.middleware !== undefined) {
      if (
        !Array.isArray(options.middleware) ||
        !options.middleware.every((fn) => typeof fn === "function")
      ) {
        throw new JmapConfigurationError("`middleware` must be an array of functions");
      }
    }
  }

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

      const session = await this.session;
      const request: JMAPRequest = {
        using: [...urnsToUse],
        methodCalls: methodCalls.map((c) => c.toInvocation()),
      };

      let body: string;
      try {
        body = JSON.stringify(request);
      } catch (cause) {
        throw new JmapConfigurationError("Method arguments cannot be serialized as JSON", {
          cause,
        });
      }
      const response = await this.#fetchJson<JMAPResponse>(session.apiUrl, body);

      const context = { request: { url: session.apiUrl, method: "POST" }, payload: response };
      if (!isRecord(response) || !Array.isArray(response.methodResponses)) {
        throw new JmapProtocolError("Invalid JMAP method responses", context);
      }
      const expectedIds = new Set(methodCalls.map((call) => call.id));
      const resultById = new Map<string, MethodCallResult<unknown>>();
      for (const invocation of response.methodResponses) {
        if (
          !Array.isArray(invocation) ||
          invocation.length !== 3 ||
          typeof invocation[0] !== "string" ||
          !isRecord(invocation[1]) ||
          typeof invocation[2] !== "string" ||
          !expectedIds.has(invocation[2])
        ) {
          throw new JmapProtocolError("Invalid or unassociated method response", context);
        }
        const result = new MethodCallResult<unknown>([invocation[0], invocation[1], invocation[2]]);
        const call = methodCalls.find((entry) => entry.id === result.id)!;
        if (result.method !== call.method && result.method !== "error") continue;
        if (resultById.has(result.id))
          throw new JmapProtocolError("Duplicate method response ID", context);
        resultById.set(result.id, result);
      }

      for (const { payload: methodCall, handle } of jobs) {
        const result = resultById.get(methodCall.id);
        if (!result) {
          handle.reject(
            new JmapProtocolError(`No response for method call "${methodCall.id}"`, {
              ...context,
              methodCall: methodCall.toInvocation(),
            }),
          );
          continue;
        }

        const { data } = result;
        if (result.method === "error") {
          handle.reject(
            JmapError.isProblemDetails(data)
              ? new JmapError(
                  typeof data.description === "string"
                    ? data.description
                    : `Error in ${methodCall.method}: ${data.type}`,
                  data,
                  methodCall.toInvocation(),
                )
              : new JmapProtocolError("Invalid method error", {
                  ...context,
                  methodCall: methodCall.toInvocation(),
                }),
          );
        } else if (result.method !== methodCall.method) {
          handle.reject(
            new JmapProtocolError("Unexpected method response name", {
              ...context,
              methodCall: methodCall.toInvocation(),
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

  #fetchResponse = async (url: string | URL, init: RequestInit): Promise<Response> => {
    const request = { url: String(url), method: init.method ?? "GET" };
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (cause) {
      throw new JmapTransportError("JMAP transport failed", request, cause);
    }
    if (!response.ok) {
      let payload: unknown;
      let cause: unknown;
      try {
        const text = await response.text();
        payload = text;
        if (/\bjson\b/i.test(response.headers.get("content-type") ?? ""))
          payload = JSON.parse(text);
      } catch (error) {
        cause = error;
      }
      throw new JmapHttpError(response, request, payload, cause);
    }
    return response;
  };

  #fetchJson = async <T>(url: string | URL, body: BodyInit | null = null): Promise<T> => {
    const request: JmapRequestContext = {
      url: String(url),
      method: body === null ? "GET" : "POST",
    };
    const response = await this.#fetchResponse(url, {
      method: request.method,
      headers: {
        authorization: `Bearer ${this.#config.bearerToken}`,
        accept: "application/json",
        "content-type": "application/json",
      },
      body,
    });
    try {
      return await response.json();
    } catch (cause) {
      throw new JmapProtocolError("Invalid JSON response", { request, response, cause });
    }
  };

  blob = {
    upload: async (
      body: BodyInit,
      params: SetOptional<BlobUploadParams, "accountId"> = {},
    ): Promise<BlobUploadResponse> => {
      const session = await this.session;
      if (typeof session.uploadUrl !== "string")
        throw new JmapProtocolError("Missing upload URL", { payload: session });
      const url = expandURITemplate(session.uploadUrl, {
        accountId: params.accountId ?? session.primaryAccounts[mail.urn]!,
      });
      const data = await this.#fetchJson<BlobUploadResponse>(url, body);
      if (
        !isRecord(data) ||
        typeof data.accountId !== "string" ||
        typeof data.blobId !== "string" ||
        typeof data.type !== "string" ||
        typeof data.size !== "number" ||
        !Number.isFinite(data.size) ||
        data.size < 0
      ) {
        throw new JmapProtocolError("Invalid blob upload response", {
          request: { url, method: "POST" },
          payload: data,
        });
      }
      return data;
    },
    download: async (params: SetOptional<BlobDownloadParams, "accountId">): Promise<Response> => {
      const session = await this.session;
      if (typeof session.downloadUrl !== "string")
        throw new JmapProtocolError("Missing download URL", { payload: session });
      const url = expandURITemplate(session.downloadUrl, {
        ...params,
        accountId: params.accountId ?? session.primaryAccounts[mail.urn]!,
      });
      const response = await this.#fetchResponse(url, {
        method: "GET",
        headers: {
          authorization: `Bearer ${this.#config.bearerToken}`,
        },
      });
      return response;
    },
  };

  onStateChange = async (
    handler: (change: StateChangePayload) => void,
    { pingSeconds = 30, signal }: OnStateChangeOptions = {},
  ) => {
    const session = await this.session;
    const primaryAccountId = session.primaryAccounts[mail.urn]!;
    if (typeof session.eventSourceUrl !== "string")
      throw new JmapProtocolError("Missing event source URL", { payload: session });
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
          const { changed } = payload as StateChange;
          for (const [accountId, changes] of Object.entries(changed)) {
            for (const [entity, state] of Object.entries(changes)) {
              handler({
                entity,
                state,
                accountId,
                isPrimaryAccount: accountId === primaryAccountId,
              });
            }
          }
        } catch {
          //
        }
      },
    });
    signal?.addEventListener("abort", () => eventSource.close());
    return {
      [Symbol.dispose ?? "disconnect"]: () => eventSource.close(),
    };
  };
}

export interface StateChangePayload {
  /** The account that the change occurred in  */
  accountId: string;
  /** Whether the account ID is that of the primary account */
  isPrimaryAccount: boolean;
  /** The type of entity that saw a change */
  entity: string;
  /** An opaque string that can be passed to `{Entity}/queryChanges`  */
  state: string;
}

export interface OnStateChangeOptions {
  /** An abort signal that can terminate the event source */
  signal?: AbortSignal;
  /** An interval in seconds to request that the server send pings */
  pingSeconds?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
