import type { Invocation, Request as JmapRequest, Response, Session } from "jmap-rfc-types";

import { Batcher, type Transport } from "./batch.js";
import { Capability } from "./capability.js";
import { JmapError } from "./error.js";
import type { Api, GlobalEntity } from "./types.js";

const CORE_CAPABILITY = "urn:ietf:params:jmap:core";

interface Config<Entity extends GlobalEntity> {
  bearerToken: string;
  sessionUrl: string;
  capabilities?: ReadonlyArray<Capability<Entity>>;
}

export class Client<Entity extends GlobalEntity> {
  readonly #config: Required<Config<Entity>>;
  readonly #entityToUrn: ReadonlyMap<string, string>;
  readonly #batcher: Batcher;
  #sessionPromise?: Promise<Session>;

  /**
   * Strongly typed, promise-based entry point to the server. Calls made within
   * the same microtask are automatically coalesced into a single JMAP request.
   *
   * @example
   * ```ts
   * const [inbox, drafts] = await Promise.all([
   *   client.api.Mailbox.get({ accountId, ids: [inboxId] }),
   *   client.api.Mailbox.get({ accountId, ids: [draftsId] }),
   * ]); // one HTTP round trip
   * ```
   */
  readonly api: Api<Entity>;

  constructor(config: Config<Entity>) {
    this.#config = Object.freeze({
      bearerToken: config.bearerToken,
      sessionUrl: config.sessionUrl,
      capabilities: Array.from(config.capabilities ?? []),
    });

    this.#entityToUrn = new Map(
      this.#config.capabilities.flatMap(({ urn, entities }) =>
        entities.map((entity) => [entity, urn] as const),
      ),
    );

    this.#batcher = new Batcher({
      transport: this.#transport,
      resolveUsing: (method) => this.#usingFor(method),
    });

    this.api = this.#createApi();
  }

  getSession(): Promise<Session> {
    return (this.#sessionPromise ??= this.#fetchJson<Session>(this.#config.sessionUrl));
  }

  async #fetchJson<T>(url: string, body: string | null = null): Promise<T> {
    const response = await fetch(url, {
      method: body === null ? "GET" : "POST",
      headers: {
        authorization: `Bearer ${this.#config.bearerToken}`,
        accept: "application/json",
        "content-type": "application/json",
      },
      body,
    });

    const isJson = /\bjson\b/.test(response.headers.get("content-type") ?? "");
    const payload: unknown = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      if (JmapError.isProblemDetails(payload)) {
        throw new JmapError("JMAP request failed", payload);
      }
      throw new Error(`JMAP request failed (${response.status})`, { cause: payload });
    }

    return payload as T;
  }

  readonly #transport: Transport = async (methodCalls, using) => {
    const session = await this.getSession();
    const request: JmapRequest = {
      using: [...using],
      methodCalls: methodCalls as Invocation[],
    };
    return await this.#fetchJson<Response>(session.apiUrl, JSON.stringify(request));
  };

  /** Capability URNs required to invoke the given `Entity/method` name. */
  #usingFor(method: string): Iterable<string> {
    const using = new Set<string>([CORE_CAPABILITY]);
    const slash = method.indexOf("/");
    const entity = slash === -1 ? method : method.slice(0, slash);
    const urn = this.#entityToUrn.get(entity);
    if (urn !== undefined) {
      using.add(urn);
    }
    return using;
  }

  /**
   * Builds the nested proxy exposed as `client.api`. The outer proxy resolves
   * an entity name (e.g. `Email`); the inner proxy resolves a method name
   * (e.g. `get`) into a function that enqueues an `Email/get` invocation.
   */
  #createApi(): Api<Entity> {
    const batcher = this.#batcher;
    const entityProxies = new Map<string, object>();

    return new Proxy(Object.create(null) as Api<Entity>, {
      get(_target, entity) {
        if (typeof entity !== "string") {
          return undefined;
        }

        let methods = entityProxies.get(entity);
        if (methods === undefined) {
          methods = new Proxy(Object.create(null) as object, {
            get(_methodTarget, method) {
              // Guard against promise-unwrapping probes (e.g. `then`) and
              // symbol access so the proxy is never mistaken for a thenable.
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

export { Capability, KNOWN_CAPABILITIES } from "./capability.js";
export { JmapError } from "./error.js";
export type { Api, GlobalEntity, GlobalMethodCalls } from "./types.js";
