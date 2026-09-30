import { JmapAbortError } from "../error.ts";
import type { Flush } from "./batch.ts";
import type { MethodCall } from "./method-calls.ts";
import { referencedMethodCallIds } from "./request-limits.ts";

type MethodJobs = Parameters<Flush<MethodCall<unknown>>>[0];

export function cancellationScope(jobs: MethodJobs) {
  const controller = new AbortController();
  const canceled = new Map<string, unknown>();
  let sent = false;
  const active = () => {
    for (const job of jobs)
      if (job.signal?.aborted && job.canceled) canceled.set(job.payload.id, job.signal.reason);
    if (!sent) {
      let changed = true;
      while (changed) {
        changed = false;
        for (const job of jobs) {
          if (canceled.has(job.payload.id)) continue;
          const source = referencedMethodCallIds(job.payload.args).find((id) => canceled.has(id));
          if (source !== undefined) {
            canceled.set(job.payload.id, canceled.get(source));
            job.handle.reject(new JmapAbortError(canceled.get(source)));
            changed = true;
          }
        }
      }
    }
    return jobs.filter((job) => !canceled.has(job.payload.id));
  };
  const update = () => {
    if (active().length === 0 && !controller.signal.aborted)
      controller.abort(new JmapAbortError(canceled.values().next().value));
  };
  for (const job of jobs) job.signal?.addEventListener("abort", update);
  update();
  return {
    signal: controller.signal,
    active,
    markSent: () => {
      sent = true;
    },
    dispose: () => {
      for (const job of jobs) job.signal?.removeEventListener("abort", update);
    },
  };
}

export function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new JmapAbortError(signal.reason));
    if (signal.aborted) {
      promise.catch(() => {});
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}
