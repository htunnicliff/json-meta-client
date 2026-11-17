import type { SourceInfo, SourcePosition, SourceRange } from "./instrument.ts";
import type { TimelineCall } from "./timeline.ts";
import type { Trace } from "./tracer.ts";

/**
 * Where a run's method calls were made and where it waits, in the user's code
 */
export interface SourceLines {
  /** Where each method call was made, by label */
  calls: Record<string, SourceRange>;
  /** Each `await` with pending awaits, in source order */
  waiting: WaitingAwait[];
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

  return { calls, waiting };
}

function compare(a: SourceRange["start"], b: SourceRange["start"]): number {
  return a.line - b.line || a.column - b.column;
}

/**
 * The labels of the method calls made at the innermost call site containing
 * `position`
 */
export function labelsAt(lines: SourceLines, position: SourcePosition): string[] {
  const containing = Object.entries(lines.calls).filter(([, range]) => contains(range, position));
  if (!containing.length) return [];
  const smallest = Math.min(...containing.map(([, range]) => size(range)));
  return containing.filter(([, range]) => size(range) === smallest).map(([label]) => label);
}

function size({ start, end }: SourceRange): number {
  return (end.line - start.line) * 10_000 + end.column - start.column;
}

function contains({ start, end }: SourceRange, position: SourcePosition): boolean {
  return compare(start, position) <= 0 && compare(position, end) <= 0;
}
