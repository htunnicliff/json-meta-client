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
import { JmapError } from "./error.ts";
import { Batch } from "./internal/batch.ts";
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
  middleware?: ReadonlyArray<Middleware>;
}

export class Client<
  T extends ReadonlyArray<Capability>,
  API extends ClientApi<T> & ClientApi<typeof DEFAULT_CAPABILITIES>,
> {
  readonly #config: Required<Config<T>>;

  readonly #entityToUrn: Record<string, string>;

  readonly api: API;

  #sessionPromise: Promise<Session> | undefined;

  #session: Session | undefined;

  constructor(options: Config<T>) {
    if (!URL.canParse(options.sessionUrl)) {
      throw new Error("Invalid session URL", { cause: options.sessionUrl });
    }

    this.#config = {
      bearerToken: options.bearerToken,
      sessionUrl: options.sessionUrl,
      capabilities: options.capabilities,
      middleware: [
        replaceNestedResultRefKeys,
        injectAccountId(() => {
          if (!this.#session) throw new Error("Session not yet resolved");
          return this.#session;
        }),
        ...(options.middleware ?? []),
      ],
    };

    this.#entityToUrn = mapEntitiesToUrns(this.#config.capabilities);

    const batch = new Batch<MethodCall<unknown>>(async (jobs) => {
      try {
        const methodCalls = jobs.map((b) => b.payload);

        const urnsToUse = new Set<string>();

        for (const { urn } of DEFAULT_CAPABILITIES) {
          urnsToUse.add(urn);
        }

        for (const { method } of methodCalls) {
          const [entity] = /^[^/]+/.exec(method)!;
          const urn = this.#entityToUrn[entity];
          if (urn) {
            urnsToUse.add(urn);
          }
        }

        const request: JMAPRequest = {
          using: [...urnsToUse],
          methodCalls: methodCalls.map((c) => c.toInvocation()),
        };

        const response = await this.#fetchJson<JMAPResponse>(
          (await this.session).apiUrl,
          JSON.stringify(request),
        );

        const resultById = new Map(
          response.methodResponses.map((invocation) => {
            const result = new MethodCallResult(invocation);
            return [result.id, result];
          }),
        );

        for (const { payload: methodCall, handle } of jobs) {
          const result = resultById.get(methodCall.id);
          if (!result) {
            handle.reject(new Error(`No response for method call "${methodCall.id}"`));
            continue;
          }

          const { data } = result;
          if (result.method === "error") {
            handle.reject(
              JmapError.isProblemDetails(data)
                ? new JmapError("Error in method call", data)
                : new Error("Unknown error in method call", { cause: data }),
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
    });

    this.api = createApi<API>(batch.enqueue, this.#config.middleware);

    Object.freeze(this);
  }

  get session(): Promise<Session> {
    return this.#sessionPromise ?? this.refreshSession();
  }

  refreshSession = (): Promise<Session> => {
    this.#sessionPromise = this.#fetchJson<Session>(this.#config.sessionUrl).then((result) => {
      this.#session = result;
      return result;
    });

    return this.#sessionPromise;
  };

  #fetchJson = async <T>(url: string | URL, body: BodyInit | null = null): Promise<T> => {
    const response = await fetch(url, {
      method: body === null ? "GET" : "POST",
      headers: {
        authorization: `Bearer ${this.#config.bearerToken}`,
        accept: "application/json",
        "content-type": "application/json",
      },
      body,
    });

    const isJsonResponse = /\bjson\b/.test(response.headers.get("content-type")!);

    const payload = await (isJsonResponse ? response.json() : response.text());

    if (!response.ok) {
      throw new Error(`JMAP request failed (${response.status})`, { cause: payload });
    }

    return payload;
  };

  blob = {
    upload: async (
      body: BodyInit,
      params: SetOptional<BlobUploadParams, "accountId"> = {},
    ): Promise<BlobUploadResponse> => {
      const session = await this.session;
      const url = expandURITemplate(session.uploadUrl, {
        accountId: params.accountId ?? session.primaryAccounts[mail.urn]!,
      });
      const data = await this.#fetchJson<BlobUploadResponse>(url, body);
      return data;
    },
    download: async (params: SetOptional<BlobDownloadParams, "accountId">): Promise<Response> => {
      const session = await this.session;
      const url = expandURITemplate(session.downloadUrl, {
        ...params,
        accountId: params.accountId ?? session.primaryAccounts[mail.urn]!,
      });
      const response = await fetch(url, {
        method: "GET",
        headers: {
          authorization: `Bearer ${this.#config.bearerToken}`,
        },
      });
      if (!response.ok) {
        const isJsonResponse = /\bjson\b/.test(response.headers.get("content-type")!);
        const cause = await (isJsonResponse ? response.json() : response.text());
        throw new Error(`Download request failed (${response.status})`, { cause });
      }
      return response;
    },
  };

  onStateChange = async (
    handler: (change: StateChangePayload) => void,
    { pingSeconds = 30, signal }: OnStateChangeOptions = {},
  ) => {
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
