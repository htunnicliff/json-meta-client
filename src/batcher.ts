interface BatchInput<Output = unknown> {
  args: unknown[];
  fn: (...args: any[]) => unknown;
  promise: PromiseWithResolvers<Output>;
}

const DEFAULT_FLUSH = (inputs: BatchInput[]): void => {
  for (const { args, fn, promise } of inputs) {
    try {
      promise.resolve(fn(...args));
    } catch (error) {
      promise.reject(error);
    }
  }
};

export function makeBatcher(flush: (inputs: BatchInput[]) => void | Promise<void> = DEFAULT_FLUSH) {
  let flushScheduled = false;
  const inputs: BatchInput<any>[] = [];

  function batch<Args extends unknown[], Returning>(fn: (...args: Args) => Returning) {
    return function batched(...args: Args): Promise<Returning> {
      // Capture
      const input: BatchInput<Returning> = {
        args,
        fn,
        promise: Promise.withResolvers(),
      };

      // Batch
      inputs.push(input);

      // Schedule flush
      if (!flushScheduled) {
        flushScheduled = true;
        queueMicrotask(() => {
          flushScheduled = false;
          const drained = inputs.splice(0);
          void flush(drained);
        });
      }

      return input.promise.promise;
    };
  }

  return batch;
}

// const batch = makeBatcher();

// export class API {
//   sayHello = batch((name: string, age: number) => {
//     console.log("Executing...", { name, age });
//     return `Hello, ${name}! You are ${age.toLocaleString()} at ${performance.now()}`;
//   });
// }

// const api = new API();

// const pendingA = api.sayHello("Joe", 10);
// const pendingB = api.sayHello("John", 12);
// const pendingC = api.sayHello("Jim", 49);

// console.log("Invoked");

// const results = await Promise.all([pendingA, pendingB, pendingC]);

// console.log(results);
