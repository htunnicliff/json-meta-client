import { JmapAbortError } from "../error.ts";
import { isRef } from "../ref.ts";
import type { MethodCall } from "./method-calls.ts";

export interface RequestLimits {
  maxCallsInRequest?: number;
  maxSizeRequest?: number;
  maxConcurrentRequests?: number;
}

export interface LimitFailure {
  limit: "maxCallsInRequest" | "maxSizeRequest";
  maximum: number;
  actual: number;
}

export function requestLimitFailure(
  calls: readonly MethodCall<unknown>[],
  limits: RequestLimits,
  serialize: (calls: readonly MethodCall<unknown>[]) => string,
): LimitFailure | undefined {
  if (limits.maxCallsInRequest !== undefined && calls.length > limits.maxCallsInRequest) {
    return { limit: "maxCallsInRequest", maximum: limits.maxCallsInRequest, actual: calls.length };
  }
  if (limits.maxSizeRequest !== undefined) {
    const actual = new TextEncoder().encode(serialize(calls)).byteLength;
    if (actual > limits.maxSizeRequest) {
      return { limit: "maxSizeRequest", maximum: limits.maxSizeRequest, actual };
    }
  }
  return undefined;
}

export function referencedMethodCallIds(
  value: unknown,
  wireReference = false,
  seen = new WeakSet<object>(),
): string[] {
  if (typeof value !== "object" || value === null) return [];
  if (
    (isRef(value) || wireReference) &&
    "resultOf" in value &&
    typeof value.resultOf === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "path" in value &&
    typeof value.path === "string"
  ) {
    return [value.resultOf];
  }
  if (seen.has(value)) return [];
  seen.add(value);
  return Object.entries(Object.getOwnPropertyDescriptors(value)).flatMap(([key, descriptor]) =>
    "value" in descriptor
      ? referencedMethodCallIds(descriptor.value, key.startsWith("#"), seen)
      : [],
  );
}

export function partitionMethodCalls(
  calls: readonly MethodCall<unknown>[],
  limits: RequestLimits,
  serialize: (calls: readonly MethodCall<unknown>[]) => string,
) {
  const groups = calls.map((call) => new Set([call]));
  const groupById = new Map(calls.map((call, index) => [call.id, groups[index]!]));
  for (const call of calls) {
    for (const id of referencedMethodCallIds(call.args)) {
      const source = groupById.get(id);
      const target = groupById.get(call.id)!;
      if (!source || source === target) continue;
      for (const member of source) {
        target.add(member);
        groupById.set(member.id, target);
      }
    }
  }
  const rejected: { calls: MethodCall<unknown>[]; failure: LimitFailure }[] = [];
  const excluded = new Set<MethodCall<unknown>>();
  for (const group of new Set(groupById.values())) {
    const members = calls.filter((call) => group.has(call));
    const failure = requestLimitFailure(members, limits, serialize);
    if (failure) {
      rejected.push({ calls: members, failure });
      for (const member of members) excluded.add(member);
    }
  }
  const remaining = calls.filter((call) => !excluded.has(call));
  const lastIndex = new Map(remaining.map((call, index) => [groupById.get(call.id)!, index]));
  const blocks: MethodCall<unknown>[][] = [];
  let block: MethodCall<unknown>[] = [];
  let end = -1;
  for (const [index, call] of remaining.entries()) {
    block.push(call);
    end = Math.max(end, lastIndex.get(groupById.get(call.id)!)!);
    if (index === end) {
      blocks.push(block);
      block = [];
    }
  }
  const requests: MethodCall<unknown>[][] = [];
  let pending: MethodCall<unknown>[] = [];
  for (const block of blocks) {
    const failure = requestLimitFailure(block, limits, serialize);
    if (failure) {
      rejected.push({ calls: block, failure });
      continue;
    }
    if (pending.length > 0 && requestLimitFailure([...pending, ...block], limits, serialize)) {
      requests.push(pending);
      pending = [];
    }
    pending.push(...block);
  }
  if (pending.length > 0) requests.push(pending);
  return { requests, rejected };
}

export class RequestConcurrency {
  #active = 0;
  #waiting: { maximum: number; resolve: (release: () => void) => void; cleanup: () => void }[] = [];

  acquire(maximum = Infinity, signal?: AbortSignal): Promise<() => void> {
    return new Promise((resolve, reject) => {
      const abort = () => {
        const index = this.#waiting.indexOf(entry);
        if (index >= 0) this.#waiting.splice(index, 1);
        signal?.removeEventListener("abort", abort);
        reject(new JmapAbortError(signal?.reason));
        this.#drain();
      };
      const entry = {
        maximum,
        resolve,
        cleanup: () => signal?.removeEventListener("abort", abort),
      };
      if (signal?.aborted) {
        reject(new JmapAbortError(signal.reason));
        return;
      }
      signal?.addEventListener("abort", abort, { once: true });
      this.#waiting.push(entry);
      this.#drain();
    });
  }

  #drain() {
    while (this.#waiting.length > 0 && this.#active < this.#waiting[0]!.maximum) {
      const next = this.#waiting.shift()!;
      this.#active++;
      next.cleanup();
      next.resolve(() => {
        this.#active--;
        this.#drain();
      });
    }
  }
}
