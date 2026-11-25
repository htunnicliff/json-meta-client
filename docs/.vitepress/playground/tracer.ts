/** The global the instrumented code reports to */
export const TRACER = "__playground";

/** What a run reports about the instrumented code */
export interface Trace {
  /**
   * Each JMAP call id the playground named, such as `unread`, or the random
   * suffix of one the library drew, as in `f3c9ebfd` for
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
  let currentName: string | undefined;
  const usedIds = new Set<string>();
  return {
    trace: (): Trace => ({ ...trace }),
    /**
     * A method call id named after the variable the call is bound to, such as
     * `unread`, or else after its method, such as `Email/get`. Ids repeat
     * nowhere in a run: a repeat gets a suffix, as in `unread-2`.
     */
    generateMethodCallId: (method: string): string => {
      const base = currentName ?? method;
      currentName = undefined;
      let id = base;
      for (let count = 2; usedIds.has(id); count++) {
        id = `${base}-${count}`;
      }
      usedIds.add(id);
      if (current !== undefined) {
        trace.calls[id] = current;
      }
      return id;
    },
    /** Record the call site of a call id suffix the library just drew */
    onCallId: (suffix: string) => {
      if (current !== undefined) {
        trace.calls[suffix] = current;
      }
    },
    runtime: {
      m(loc: number, args: unknown[], name?: string): unknown[] {
        current = loc;
        currentName = name;
        return args;
      },
      a(loc: number, value: unknown): Promise<unknown> {
        trace.pending[loc] = (trace.pending[loc] ?? 0) + 1;
        const id: unknown =
          value && typeof value === "object" ? Reflect.get(value, "$id") : undefined;
        if (typeof id === "string") {
          (trace.awaited[loc] ??= []).push(id);
        }
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
