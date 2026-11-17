/** The global the instrumented code reports to */
export const TRACER = "__playground";

/** What a run reports about the instrumented code */
export interface Trace {
  /**
   * The random suffix of each JMAP call id, as in `f3c9ebfd` for
   * `Email/query::f3c9ebfd` → the location of the call that made it
   */
  calls: Record<string, number>;
  /** Await location → how many awaits there are pending now */
  pending: Record<number, number>;
  /** Await location → the call ids of the method calls it is waiting on, when known */
  awaited: Record<number, string[]>;
}

/**
 * The runtime that instrumented code reports to, and the {@link Trace} it
 * keeps
 */
export function createTracer() {
  const trace: Trace = { calls: {}, pending: {}, awaited: {} };
  let current: number | undefined;
  return {
    trace: (): Trace => ({ ...trace }),
    /** Record the call site of a call id suffix the library just drew */
    onCallId: (suffix: string) => {
      if (current !== undefined) trace.calls[suffix] = current;
    },
    runtime: {
      m(loc: number, args: unknown[]): unknown[] {
        current = loc;
        return args;
      },
      a(loc: number, value: unknown): Promise<unknown> {
        trace.pending[loc] = (trace.pending[loc] ?? 0) + 1;
        const id: unknown =
          value && typeof value === "object" ? Reflect.get(value, "$id") : undefined;
        if (typeof id === "string") (trace.awaited[loc] ??= []).push(id);
        const done = () => {
          trace.pending[loc] = (trace.pending[loc] ?? 1) - 1;
          if (typeof id === "string") {
            trace.awaited[loc] = (trace.awaited[loc] ?? []).filter((awaited) => awaited !== id);
          }
        };
        return Promise.resolve(value).finally(done);
      },
    },
  };
}
