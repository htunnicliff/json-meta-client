interface Work<Input, Output = any> {
  input: Input;
  handle: PromiseWithResolvers<Output>;
}

export type BatchResult<Input, Output> = Input & Promise<Output>;

interface Flush<Input> {
  (batchedWork: Work<Input>[]): void | Promise<void>;
}

/**
 * A utility for scheduling a batch of work to be
 * resolved at the same time
 *
 * @example
 * ```ts
 * const batcher = new Batcher((batchedWork) => {
 *   for (const { input, handle } of batchedWork) {
 *     try {
 *       handle.resolve(doSomething(input));
 *     } catch (error) {
 *       handle.reject(error);
 *     }
 *   }
 * });
 * ```
 */
export class Batcher<Input = unknown> {
  constructor(flush: Flush<Input>) {
    this.#flush = flush;
  }

  /**
   * All work input yet to be flushed
   */
  #pendingWork: Work<Input>[] = [];

  /**
   * Whether a flush has been queued in the next microtask
   */
  #flushPending = false;

  /**
   * Function to process a batch of work
   */
  #flush: Flush<Input>;

  /**
   * Push some input into the next batch and return a promise for
   * the result for the given input
   */
  enqueue = <Output = unknown, I extends Input = Input>(input: I): BatchResult<I, Output> => {
    // Create a promise for providing the output
    const handle = Promise.withResolvers<Output>();

    // Add work to the batch
    this.#pendingWork.push({ input, handle });

    // Schedule a flush
    this.#scheduleFlush();

    const result: BatchResult<I, Output> = Object.assign(handle.promise, input);

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

        // Get batch of work while emptying pending array
        const batch = this.#pendingWork.splice(0);

        // Flush batch
        void this.#flush(batch);
      });
    }
  }
}
