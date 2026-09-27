interface Job<Payload, Output = any> {
  payload: Payload;
  handle: PromiseWithResolvers<Output>;
}

export type JobResult<Input, Output> = Input & Promise<Output>;

interface Flush<Input> {
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
  enqueue = <Output = unknown, I extends Input = Input>(input: I): JobResult<I, Output> => {
    // Create a promise for providing the output
    const handle = Promise.withResolvers<Output>();

    // Add job to the queue
    this.#queue.push({ payload: input, handle });

    // Schedule a flush
    this.#scheduleFlush();

    const result: JobResult<I, Output> = Object.assign(handle.promise, input);

    // Supply the output promise
    return result;
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
        void this.#flush(queuedJobs);
      });
    }
  }
}
