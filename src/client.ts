import type { Request as JmapRequest, Response as JmapResponse, Session } from "jmap-rfc-types";
import type { UnionToIntersection } from "type-fest";

import { createApi } from "./api.ts";
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
import { mapEntitiesToUrns } from "./internal/map-entities-to-urns.ts";
import { MethodCall, MethodCallResult } from "./internal/method-calls.ts";
import { injectAccountId } from "./internal/middleware/inject-account-id.ts";
import { replaceNestedResultRefKeys } from "./internal/middleware/replace-nested-result-ref-keys.ts";
import type { Middleware } from "./internal/types.ts";

const DEFAULT_CAPABILITIES = [core, mail, submission, vacationresponse];

type BaseAPI =
  typeof DEFAULT_CAPABILITIES extends ReadonlyArray<infer U>
    ? Augment<UnionToIntersection<InferMethodsFromCapability<U>>>
    : never;

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

        const request: JmapRequest = {
          using: [...capabilityUrns],
          methodCalls: methodCalls.map((c) => c.toInvocation()),
        };

        const response = await this.#fetchJson<JmapResponse>(
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

  refreshSession(): Promise<Session> {
    this.#sessionPromise = this.#fetchJson<Session>(this.#config.sessionUrl).then((result) => {
      this.#session = result;
      return result;
    });

    return this.#sessionPromise;
  }

  #fetchJson = async <T>(url: string | URL, body: string | null = null): Promise<T> => {
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
}
