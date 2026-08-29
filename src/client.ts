import type { Request as JmapRequest, Response as JmapResponse, Session } from "jmap-rfc-types";
import type { JsonObject, UnionToIntersection } from "type-fest";

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
import { MethodCall, MethodCallResult } from "./internal/method-calls.ts";
import { replaceNestedResultRefKeys } from "./internal/refs.ts";

const builtInCapabilities = [core, mail, submission, vacationresponse];

type BaseAPI =
  typeof builtInCapabilities extends ReadonlyArray<infer U>
    ? Augment<UnionToIntersection<InferMethodsFromCapability<U>>>
    : never;

export interface Config<
  C extends ReadonlyArray<Capability<string, CapabilityMethods<string>>> = [],
> {
  bearerToken: string;
  sessionUrl: string | URL;
  capabilities?: C;
}

export class Client<
  C extends ReadonlyArray<Capability<string, CapabilityMethods<string>>>,
  API extends C extends ReadonlyArray<infer U>
    ? Augment<UnionToIntersection<InferMethodsFromCapability<U>>> & BaseAPI
    : BaseAPI,
> {
  readonly #config: Required<Config<C>>;

  readonly #entityToUrn: Record<string, string>;

  readonly #session: Promise<Session>;

  #sessionSync: Session | undefined;

  readonly #batcher: Batcher<MethodCall<unknown>>;

  readonly api: API;

  constructor({ bearerToken, sessionUrl, capabilities: extraCapabilities }: Config<C>) {
    const capabilities: Array<Capability<string, CapabilityMethods<string>>> = [
      ...builtInCapabilities,
    ];

    if (extraCapabilities) {
      capabilities.push(...extraCapabilities);
    }

    if (!URL.canParse(sessionUrl)) {
      throw new Error("Invalid session URL", { cause: sessionUrl });
    }

    this.#config = {
      bearerToken,
      sessionUrl,
      // @ts-expect-error - TODO: Fix this internal type
      capabilities,
    };

    this.#entityToUrn = {};
    for (const { urn, entities } of this.#config.capabilities) {
      for (const entity of entities) {
        if (Object.hasOwn(this.#entityToUrn, entity)) {
          throw new Error(`Entity "${entity}" has already been added`);
        }

        this.#entityToUrn[entity] = urn;
      }
    }

    this.#session = this.#fetchJson<Session>(this.#config.sessionUrl).then((result) => {
      this.#sessionSync = result;
      return result;
    });

    this.api = this.#initApi();

    this.#batcher = new Batcher<MethodCall<unknown>>(async (batch) => {
      try {
        const methodCalls = batch.map((b) => b.input);

        // Determine which URNs are needed
        const capabilityUrns = new Set<string>(
          methodCalls.flatMap(({ method }) => {
            const [entity] = /^[^/]+/.exec(method)!;
            const urn = this.#entityToUrn[entity];
            return urn ? [urn] : [];
          }),
        );
        capabilityUrns.add(core.urn);

        // Submit request via transport
        const session = await this.#session;
        const request: JmapRequest = {
          using: [...capabilityUrns],
          methodCalls: methodCalls.map((c) => c.toInvocation()),
        };
        const response = await this.#fetchJson<JmapResponse>(
          session.apiUrl,
          JSON.stringify(request),
        );

        // Organize results by method call ID
        const resultById = new Map(
          response.methodResponses.map((invocation) => {
            const result = new MethodCallResult(invocation);
            return [result.id, result];
          }),
        );

        // Process each method call
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

    Object.freeze(this);
  }

  get session(): Promise<Session> {
    return this.#session;
  }

  getSessionSync(): Session {
    if (!this.#sessionSync) {
      throw new Error("Session not yet resolved");
    }

    return this.#sessionSync;
  }

  async #fetchJson<T>(url: string | URL, body: string | null = null): Promise<T> {
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
  }

  #initApi(): API {
    const batcher = this.#batcher;
    const entityProxies = new Map<string, object>();
    const transformArgs = (args: JsonObject) => {
      const transformed = replaceNestedResultRefKeys(args);

      // Add accountId if not set
      if (
        typeof transformed === "object" &&
        transformed !== null &&
        !Object.hasOwn(transformed, "accountId")
      ) {
        Object.defineProperty(transformed, "accountId", {
          // Session is not ready when this property is defined
          get: () => this.getSessionSync().primaryAccounts[mail.urn],
          enumerable: true,
        });
      }

      return transformed;
    };

    return new Proxy<API>(Object.create(null), {
      get(_, entity) {
        if (typeof entity !== "string") {
          return undefined;
        }

        let methods = entityProxies.get(entity);
        if (methods === undefined) {
          methods = new Proxy(Object.create(null), {
            get(__, method) {
              if (typeof method !== "string" || method === "then") {
                return undefined;
              }

              const actualMethod = `${entity}/${method}`;

              return (args: JsonObject) => {
                const call = new MethodCall({
                  method: actualMethod,
                  args: transformArgs(args),
                });
                return batcher.enqueue(call);
              };
            },
          });
          entityProxies.set(entity, methods!);
        }
        return methods;
      },
    });
  }
}
