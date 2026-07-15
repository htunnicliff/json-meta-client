import type { Invocation, Response as JMAPResponse } from "jmap-rfc-types";

import { JmapError } from "./error.ts";

export type TransportFn = (
  methodCalls: ReadonlyArray<Invocation>,
  using: ReadonlyArray<string>,
) => Promise<JMAPResponse>;

export type ResolveUrnsForMethodCallFn = (method: string) => ReadonlyArray<string>;

interface PendingInvocation {
  readonly invocation: Invocation;
  readonly methodCallId: string;
  readonly resolve: (value: unknown) => void;
  readonly reject: (reason: unknown) => void;
}

interface MethodCallBatcherConfig {
  transport: TransportFn;
  resolveUsing: ResolveUrnsForMethodCallFn;
}

export class MethodCallBatcher {
  constructor(config: MethodCallBatcherConfig) {
    this.#transport = config.transport;
    this.#resolveUsing = config.resolveUsing;
  }

  readonly #transport: TransportFn;

  readonly #resolveUsing: ResolveUrnsForMethodCallFn;

  #pendingInvocations: PendingInvocation[] = [];

  #flushScheduled = false;

  enqueue(
    method: string,
    args: unknown,
    methodCallId = `${method}::${crypto.randomUUID()}`,
  ): Promise<unknown> {
    const invocationPromise = Promise.withResolvers<unknown>();

    this.#pendingInvocations.push({
      invocation: [method, args, methodCallId],
      methodCallId,
      resolve: invocationPromise.resolve,
      reject: invocationPromise.reject,
    });

    this.#scheduleFlush();

    return invocationPromise.promise;
  }

  #scheduleFlush(): void {
    if (!this.#flushScheduled) {
      this.#flushScheduled = true;
      queueMicrotask(() => void this.#flush());
    }
  }

  async #flush(): Promise<void> {
    const batch = this.#pendingInvocations;
    this.#pendingInvocations = [];
    this.#flushScheduled = false;

    const methodCalls = batch.map((call) => call.invocation);

    const capabilities: ReadonlySet<string> = new Set(
      methodCalls.flatMap(([method]) => this.#resolveUsing(method)),
    );

    let response: JMAPResponse;
    try {
      response = await this.#transport(methodCalls, [...capabilities]);
    } catch (error) {
      for (const call of batch) {
        call.reject(error);
      }
      return;
    }

    const byId = new Map<string, Invocation>();
    for (const invocation of response.methodResponses) {
      const methodCallId = invocation[2];
      byId.set(methodCallId, invocation);
    }

    for (const call of batch) {
      const methodCallId = call.invocation[2];
      const result = byId.get(methodCallId);

      if (!result) {
        call.reject(new Error(`No response for method call "${methodCallId}"`));
        continue;
      }

      const [name, data] = result;
      if (name === "error" && JmapError.isProblemDetails(data)) {
        call.reject(new JmapError("Error in method call", data));
      } else {
        call.resolve(data);
      }
    }
  }
}
