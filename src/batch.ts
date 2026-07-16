import type { Invocation, Response as JMAPResponse } from "jmap-rfc-types";

import { JmapError } from "./error.ts";
import { MethodCall, MethodCallResult } from "./method-calls.ts";

export type TransportFn = (
  methodCalls: ReadonlyArray<Invocation>,
  using: ReadonlyArray<string>,
) => Promise<JMAPResponse>;

export type ResolveUrnsForMethodCallFn = (method: string) => ReadonlyArray<string>;

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

  #methodCalls: MethodCall<unknown, unknown>[] = [];

  #flushScheduled = false;

  /**
   * Add a method call to the current batch
   */
  enqueue<T>(
    method: string,
    args: T,
    id = `${method}::${crypto.randomUUID()}`,
  ): MethodCall<T, unknown> {
    const methodCall = new MethodCall<T, unknown>({
      method,
      args,
      id,
    });

    this.#methodCalls.push(methodCall);

    this.#scheduleFlush();

    return methodCall;
  }

  /**
   * Trigger a flush on the next microtask
   */
  #scheduleFlush(): void {
    if (!this.#flushScheduled) {
      this.#flushScheduled = true;
      queueMicrotask(() => void this.#flush());
    }
  }

  /**
   * Get method calls from batch and mark as flushed
   */
  #drainBatch() {
    const batch = this.#methodCalls.splice(0);
    this.#flushScheduled = false;
    return batch;
  }

  /**
   * Drain method calls from batch, send request, then fulfill promises
   */
  async #flush(): Promise<void> {
    // Get all method calls from the current batch
    const batch = this.#drainBatch();

    try {
      // Determine which URNs are needed
      const capabilityUrns = new Set<string>(batch.flatMap((c) => this.#resolveUsing(c.method)));

      // Compose invocations from method calls
      const invocations: Invocation[] = batch.map((c) => c.toInvocation());

      // Submit request via transport
      const response = await this.#transport(invocations, [...capabilityUrns]);

      // Organize results by method call ID
      const resultById = new Map(
        response.methodResponses.map((invocation) => {
          const result = new MethodCallResult(invocation);
          return [result.id, result];
        }),
      );

      // Process each method call
      for (const methodCall of batch) {
        const result = resultById.get(methodCall.id);
        if (!result) {
          methodCall.reject(new Error(`No response for method call "${methodCall.id}"`));
          continue;
        }

        const { data } = result;
        if (result.method === "error") {
          methodCall.reject(
            JmapError.isProblemDetails(data)
              ? new JmapError("Error in method call", data)
              : new Error("Unknown error in method call", { cause: data }),
          );
        } else {
          methodCall.resolve(data);
        }
      }
    } catch (error) {
      for (const methodCall of batch) {
        methodCall.reject(error);
      }
    }
  }
}
