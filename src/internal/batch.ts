// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { CancellationError } from "../errors.ts";

interface Job<Payload, Output = any> {
  payload: Payload;
  handle: PromiseWithResolvers<Output>;
}

export interface Flush<Input> {
  (jobs: Job<Input>[]): void | Promise<void>;
}

/**
 * A utility for scheduling a batch of jobs to be
 * resolved at the same time
 *
 * @example
 * ```ts
 * const batch = new Batch((jobs) => {
 *   for (const { input, handle } of jobs) {
 *     try {
 *       handle.resolve(doSomething(input));
 *     } catch (error) {
 *       handle.reject(error);
 *     }
 *   }
 * });
 * ```
 */
export class Batch<Input = unknown> {
  constructor(flush: Flush<Input>, { signal }: { signal?: AbortSignal } = {}) {
    this.#flush = flush;
    signal?.addEventListener("abort", () => {
      this.cancel();
    });
  }

  /**
   * All jobs yet to be flushed
   */
  #queue: Job<Input>[] = [];

  /**
   * Whether a flush has been queued in the next microtask
   */
  #flushPending = false;

  /**
   * Function to process queued jobs
   */
  #flush: Flush<Input>;

  /**
   * Push a payload into the queue and return a promise for
   * the result for the given input
   */
  enqueue = <Output = unknown>(input: Input): Promise<Output> => {
    // Create a promise for providing the output
    const handle = Promise.withResolvers<Output>();

    // Add job to the queue
    this.#queue.push({ payload: input, handle });

    // Schedule a flush
    this.#scheduleFlush();

    // Supply the output promise
    return handle.promise;
  };

  /**
   * Empty the queue without processing jobs
   */
  cancel = (): void => {
    for (const { handle } of this.#queue.splice(0)) {
      handle.reject(new CancellationError("Batch was cancelled"));
    }
  };

  /**
   * Queue up a flush for the next microtask if
   * a flush is not already scheduled
   */
  #scheduleFlush() {
    // Ignore
    if (this.#queue.length === 0) {
      return;
    }

    if (!this.#flushPending) {
      // Mark flush as pending
      this.#flushPending = true;

      // Enqueue flush
      queueMicrotask(() => {
        // Mark flush as not pending
        this.#flushPending = false;

        // Get queued jobs while emptying pending array
        const queuedJobs = this.#queue.splice(0);

        if (queuedJobs.length === 0) {
          return;
        }

        // Flush batch
        void this.#process(queuedJobs);
      });
    }
  }

  async #process(jobs: Job<Input>[]): Promise<void> {
    try {
      await this.#flush(jobs);
    } catch (error) {
      for (const { handle } of jobs) {
        handle.reject(error);
      }
    }
  }
}
