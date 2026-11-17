import type { SourceInfo, SourceRange, Trace } from "./instrument.ts";
import type { TimelineCall } from "./timeline.ts";

/**
 * Where a run's method calls were made and where it waits, in the user's code
 */
export interface SourceLines {
  /** Where each method call was made, by label */
  calls: Record<string, SourceRange>;
  /** Each `await` with pending awaits, in source order */
  waiting: WaitingAwait[];
  /**
   * Code that did not start although its function ran, so it was skipped or
   * comes after a pending `await`. Statements of functions that never ran are
   * left out: they were not skipped.
   */
  notReached: SourceRange[];
  /** Method calls in code that was not reached */
  notSent: { range: SourceRange; method: string }[];
}

export interface WaitingAwait {
  range: SourceRange;
  /** How many awaits are pending there, as with a function called in a loop */
  count: number;
  /** The method calls it is waiting on, when known */
  calls: { label: string; name: string }[];
}

/**
 * Tie a run's trace to the user's code and the panel's method calls
 */
export function sourceLines(
  source: SourceInfo,
  trace: Trace,
  timelineCalls: readonly TimelineCall[],
): SourceLines {
  const range = (loc: number) => source.ranges[loc];
  const byId = new Map(timelineCalls.map((call) => [call.callId, call]));

  const calls: Record<string, SourceRange> = {};
  for (const call of timelineCalls) {
    const suffix = call.callId.split("::").pop() ?? "";
    const loc = trace.calls[suffix];
    const found = loc === undefined ? undefined : range(loc);
    if (found) calls[call.label] = found;
  }

  const waiting = Object.entries(trace.pending)
    .filter(([, count]) => count > 0)
    .flatMap(([loc, count]): WaitingAwait[] => {
      const found = range(Number(loc));
      if (!found) return [];
      const awaited = (trace.awaited[Number(loc)] ?? []).flatMap((id) => {
        const call = byId.get(id);
        return call ? [{ label: call.label, name: call.name }] : [];
      });
      return [{ range: found, count, calls: awaited }];
    })
    .toSorted((a, b) => compare(a.range.start, b.range.start));

  const reached = new Set(trace.reached);
  const entered = new Set(
    source.statements.filter(({ loc }) => reached.has(loc)).map(({ fn }) => fn),
  );
  const skipped = source.statements
    .filter(({ loc, fn }) => !reached.has(loc) && entered.has(fn))
    .flatMap(({ loc }) => range(loc) ?? []);
  // Only the outermost: a statement inside a skipped one is skipped too
  const notReached = skipped.filter(
    (inner) => !skipped.some((outer) => outer !== inner && contains(outer, inner)),
  );

  const notSent = source.methodCallSites.flatMap(({ loc, method }) => {
    const found = range(loc);
    return found && notReached.some((outer) => contains(outer, found))
      ? [{ range: found, method }]
      : [];
  });

  return { calls, waiting, notReached, notSent };
}

function compare(a: SourceRange["start"], b: SourceRange["start"]): number {
  return a.line - b.line || a.column - b.column;
}

function contains(outer: SourceRange, inner: SourceRange): boolean {
  return compare(outer.start, inner.start) <= 0 && compare(inner.end, outer.end) <= 0;
}
