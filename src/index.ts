import type { Invocation, Request as JmapRequest, Response, Session } from "jmap-rfc-types";

import { MethodCallBatcher } from "./batch.ts";
import { Capability } from "./capability.ts";
import type { Api } from "./types.ts";

const CORE_CAPABILITY = "urn:ietf:params:jmap:core";

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

  readonly #batcher = new MethodCallBatcher({
    transport: async (methodCalls, capabilityUrns) => {
      const session = await this.getSession();
      const request: JmapRequest = {
        using: [...capabilityUrns],
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        methodCalls: methodCalls as Invocation[],
      };
      return await this.#fetchJson<Response>(session.apiUrl, JSON.stringify(request));
    },
    resolveUsing: (method) => {
      const capabilities = new Set<string>([CORE_CAPABILITY]);
      const [entity] = /^[^/]+/.exec(method)!;
      const urn = this.#capabilityUrnByEntity.get(entity);
      if (urn) {
        capabilities.add(urn);
      }
      return [...capabilities];
    },
  });

  readonly #api = this.#initApi();

  get api() {
    return this.#api;
  }

  #sessionPromise: Promise<Session> | undefined;

  getSession(): Promise<Session> {
    if (!this.#sessionPromise) {
      this.#sessionPromise = this.#fetchJson<Session>(this.#config.sessionUrl);
    }
    return this.#sessionPromise;
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
              return (args: unknown) => batcher.enqueue(`${entity}/${method}`, args);
            },
          });
          entityProxies.set(entity, methods);
        }
        return methods;
      },
    });
  }
}

export { Capability, KNOWN_CAPABILITIES } from "./capability.ts";
export { JmapError } from "./error.ts";
export type { Api, GlobalEntity, GlobalMethodCalls } from "./types.ts";
