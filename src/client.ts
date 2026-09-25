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
import { contacts } from "./capabilities/contacts.ts";
import { core } from "./capabilities/core.ts";
import { mail } from "./capabilities/mail.ts";
import { submission } from "./capabilities/submission.ts";
import { vacationresponse } from "./capabilities/vacationresponse.ts";
import type {
  Augment,
  Capability,
  CapabilityMethods,
  InferMethodsFromCapability,
} from "./capability.ts";
import { JmapError } from "./error.ts";
import { Batcher } from "./internal/batcher.ts";
import { expandURITemplate } from "./internal/expand-uri-template.ts";
import { mapEntitiesToUrns } from "./internal/map-entities-to-urns.ts";
import { MethodCall, MethodCallResult } from "./internal/method-calls.ts";
import { injectAccountId } from "./internal/middleware/inject-account-id.ts";
import { replaceNestedResultRefKeys } from "./internal/middleware/replace-nested-result-ref-keys.ts";
import type { Middleware } from "./internal/types.ts";

const DEFAULT_CAPABILITIES = [core, mail, submission, vacationresponse, contacts];

type DefaultCapabilities = typeof DEFAULT_CAPABILITIES extends ReadonlyArray<infer U> ? U : never;

type DefaultCapabilityMethods = UnionToIntersection<
  InferMethodsFromCapability<DefaultCapabilities>
>;

type BaseAPI = Augment<DefaultCapabilityMethods>;

export interface Config<
  C extends ReadonlyArray<Capability<string, CapabilityMethods<string>>> = [],
> {
  bearerToken: string;
  sessionUrl: string | URL;
  capabilities?: C;
  middleware?: ReadonlyArray<Middleware>;
}

export class Client<
  C extends ReadonlyArray<Capability<string, CapabilityMethods<string>>>,
  API extends C extends ReadonlyArray<infer U>
    ? Augment<UnionToIntersection<InferMethodsFromCapability<U>>> & BaseAPI
    : BaseAPI,
> {
  readonly #config: Required<Config<C>>;

  readonly #entityToUrn: Record<string, string>;

  readonly api: API;

  #sessionPromise: Promise<Session> | undefined;

  #session: Session | undefined;

  constructor(options: Config<C>) {
    if (!URL.canParse(options.sessionUrl)) {
      throw new Error("Invalid session URL", { cause: options.sessionUrl });
    }

    this.#config = {
      bearerToken: options.bearerToken,
      sessionUrl: options.sessionUrl,
      // @ts-expect-error - TODO: Fix this internal type
      capabilities: [...DEFAULT_CAPABILITIES, ...(options.capabilities ?? [])],
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

    const batcher = new Batcher<MethodCall<unknown>>(async (batch) => {
      try {
        const methodCalls = batch.map((b) => b.input);

        const capabilityUrns = new Set<string>(
          methodCalls.flatMap(({ method }) => {
            const [entity] = /^[^/]+/.exec(method)!;
            const urn = this.#entityToUrn[entity];
            return urn ? [urn] : [];
          }),
        );
        capabilityUrns.add(core.urn);

        const request: JMAPRequest = {
          using: [...capabilityUrns],
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

        for (const { input: methodCall, handle } of batch) {
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
        for (const { handle } of batch) {
          handle.reject(error);
        }
      }
    });

    this.api = createApi<API>(batcher.enqueue, this.#config.middleware);

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

export type StateChangePayload = {
  /** The account that the change occurred in  */
  accountId: string;
  /** Whether the account ID is that of the primary account */
  isPrimaryAccount: boolean;
  /** The type of entity that saw a change */
  entity: string;
  /** An opaque string that can be passed to `{Entity}/queryChanges`  */
  state: string;
};

export type OnStateChangeOptions = {
  /** An abort signal that can terminate the event source */
  signal?: AbortSignal;
  /** An interval in seconds to request that the server send pings */
  pingSeconds?: number;
};
