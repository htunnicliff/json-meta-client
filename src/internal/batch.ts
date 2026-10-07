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
  constructor(flush: Flush<Input>) {
    this.#flush = flush;
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
   * Queue up a flush for the next microtask if
   * a flush is not already scheduled
   */
  #scheduleFlush() {
    if (!this.#flushPending) {
      // Mark flush as pending
      this.#flushPending = true;

      // Enqueue flush
      queueMicrotask(() => {
        // Mark flush as not pending
        this.#flushPending = false;

        // Get queued jobs while emptying pending array
        const queuedJobs = this.#queue.splice(0);

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
