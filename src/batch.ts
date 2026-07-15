import type { Invocation, Response } from "jmap-rfc-types";

import { JmapError } from "./error.ts";

/**
 * Sends a batch of method calls to the server and resolves with the raw JMAP
 * {@link Response}. The `using` array lists every capability URN required by
 * the calls in the batch.
 */
export type Transport = (
  methodCalls: ReadonlyArray<Invocation>,
  using: ReadonlyArray<string>,
) => Promise<Response>;

/**
 * Resolves the capability URNs that must appear in the request's `using` array
 * for a given method (e.g. `"Email/get"` -> `"urn:ietf:params:jmap:mail"`).
 */
export type ResolveUsing = (method: string) => Iterable<string>;

interface PendingCall {
  readonly invocation: Invocation;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

/**
 * Collects method calls made within the same microtask and flushes them as a
 * single JMAP request. This mirrors the capnweb "one message, many calls"
 * batching model: consumers write natural, promise-based code and the batcher
 * transparently coalesces it into one round trip.
 */
export class Batcher {
  readonly #transport: Transport;
  readonly #resolveUsing: ResolveUsing;
  #pending: PendingCall[] = [];
  #flushScheduled = false;
  #nextId = 0;

  constructor(options: { transport: Transport; resolveUsing: ResolveUsing }) {
    this.#transport = options.transport;
    this.#resolveUsing = options.resolveUsing;
  }

  /**
   * Queue a single JMAP method call. Returns a promise for that call's result
   * arguments. All calls enqueued before the next microtask are sent together.
   */
  enqueue(method: string, args: unknown): Promise<unknown> {
    const methodCallId = `c${this.#nextId++}`;
    return new Promise<unknown>((resolve, reject) => {
      this.#pending.push({
        invocation: [method, args, methodCallId],
        resolve,
        reject,
      });
      if (!this.#flushScheduled) {
        this.#flushScheduled = true;
        queueMicrotask(() => void this.#flush());
      }
    });
  }

  async #flush(): Promise<void> {
    const batch = this.#pending;
    this.#pending = [];
    this.#flushScheduled = false;

    const methodCalls = batch.map((call) => call.invocation);

    const using = new Set<string>();
    for (const [method] of methodCalls) {
      for (const urn of this.#resolveUsing(method)) {
        using.add(urn);
      }
    }

    let response: Response;
    try {
      response = await this.#transport(methodCalls, [...using]);
    } catch (error) {
      for (const call of batch) {
        call.reject(error);
      }
      return;
    }

    // Index responses by method call id. A single call may produce multiple
    // responses; the last one keyed to a given id is the one we resolve with.
    const byId = new Map<string, Invocation>();
    for (const invocation of response.methodResponses) {
      byId.set(invocation[2], invocation);
    }

    for (const call of batch) {
      const methodCallId = call.invocation[2];
      const result = byId.get(methodCallId);

      if (!result) {
        call.reject(new Error(`No response for method call "${methodCallId}"`));
        continue;
      }

      const [name, args] = result;
      if (name === "error" && JmapError.isProblemDetails(args)) {
        call.reject(new JmapError("JMAP method-level error", args));
      } else {
        call.resolve(args);
      }
    }
  }
}
