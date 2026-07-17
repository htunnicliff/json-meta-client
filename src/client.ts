import type { Request as JmapRequest, Response, Session } from "jmap-rfc-types";

import { Batcher } from "./batcher.ts";
import { Capability } from "./capability.ts";
import { JmapError } from "./error.ts";
import { MethodCall, MethodCallResult } from "./method-calls.ts";
import type { Api } from "./types.ts";

const CORE_CAPABILITY = "urn:ietf:params:jmap:core";
const MAIL_CAPABILITY = "urn:ietf:params:jmap:mail";

interface Config {
  bearerToken: string;
  sessionUrl: string;
  capabilities?: ReadonlyArray<Capability>;
}

export class Client {
  constructor(config: Config) {
    this.#config = {
      bearerToken: config.bearerToken,
      sessionUrl: config.sessionUrl,
      capabilities: Array.from(config.capabilities ?? []),
    };

    this.#capabilityUrnByEntity = new Map(
      this.#config.capabilities.flatMap(({ urn, entities }) =>
        entities.map((entity) => [entity, urn] as const),
      ),
    );
  }

  readonly #config: Required<Config>;

  readonly #capabilityUrnByEntity: ReadonlyMap<string, string>;

  readonly #batcher = new Batcher<MethodCall<unknown>>(async (batch) => {
    try {
      const methodCalls = batch.map((b) => b.input);

      // Determine which URNs are needed
      const capabilityUrns = new Set<string>(
        methodCalls.flatMap(({ method }) => {
          const capabilities = new Set<string>([CORE_CAPABILITY]);
          const [entity] = /^[^/]+/.exec(method)!;
          const urn = this.#capabilityUrnByEntity.get(entity);
          if (urn) {
            capabilities.add(urn);
          }
          return [...capabilities];
        }),
      );

      // Submit request via transport
      const session = await this.getSession();
      const request: JmapRequest = {
        using: [...capabilityUrns],
        methodCalls: methodCalls.map((c) => c.toInvocation()),
      };
      const response = await this.#fetchJson<Response>(session.apiUrl, JSON.stringify(request));

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

  readonly #api = this.#initApi();

  get api() {
    return this.#api;
  }

  #sessionPromise: Promise<Session> | undefined;
  #session: Session | undefined;

  getSession(): Promise<Session> {
    if (!this.#sessionPromise) {
      this.#sessionPromise = this.#fetchJson<Session>(this.#config.sessionUrl).then((result) => {
        this.#session = result;
        return result;
      });
    }
    return this.#sessionPromise;
  }

  getSessionSync(): Session {
    if (!this.#session) {
      throw new Error("Session not yet resolved");
    }

    return this.#session;
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

    const payload: unknown = await (isJsonResponse ? response.json() : response.text());

    if (!response.ok) {
      throw new Error(`JMAP request failed (${response.status})`, { cause: payload });
    }

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return payload as T;
  }

  #initApi(): Api {
    const batcher = this.#batcher;
    const entityProxies = new Map<string, object>();
    const transformArgs = (args: unknown) => {
      // Add accountId if not set
      if (typeof args === "object" && args !== null && !args.accountId) {
        Object.defineProperty(args, "accountId", {
          get: () => this.getSessionSync().primaryAccounts[MAIL_CAPABILITY],
          enumerable: true,
        });
      }

      return args;
    };

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return new Proxy(Object.create(null) as Api, {
      get(_target, entity) {
        if (typeof entity !== "string") {
          return undefined;
        }

        let methods = entityProxies.get(entity);
        if (methods === undefined) {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          methods = new Proxy(Object.create(null) as object, {
            get(_methodTarget, method) {
              if (typeof method !== "string" || method === "then") {
                return undefined;
              }
              return (args: unknown) =>
                batcher.enqueue(
                  new MethodCall({
                    method: `${entity}/${method}`,
                    args: transformArgs(args),
                  }),
                );
            },
          });
          entityProxies.set(entity, methods);
        }
        return methods;
      },
    });
  }
}
