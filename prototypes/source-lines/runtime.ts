// PROTOTYPE (#201): the `__pg` object the instrumented code calls.
import type { Instrumented } from "./transform.ts";

export interface Report {
  ranges: Instrumented["ranges"];
  /** JMAP call id -> loc of the call expression that created it */
  calls: Record<string, number>;
  /** Pending `await`s: loc -> how many are pending right now */
  pending: Record<number, number>;
  /** Statement loc -> times started */
  reached: Record<number, number>;
  /** Statements that have not started, minus those in never-entered functions */
  notReached: number[];
}

export function createRuntime(inst: Instrumented) {
  let marker = -1;
  const calls = new Map<string, number>();
  const pending = new Map<number, number>();
  const reached = new Map<number, number>();

  // Replace crypto.getRandomValues the way the request recorder (#202) does,
  // and note the current marker for each id suffix that randomHex derives.
  const original = crypto.getRandomValues.bind(crypto);
  (crypto as any).getRandomValues = (arr: Uint16Array) => {
    const result = original(arr);
    if (arr instanceof Uint16Array && marker >= 0) {
      let hex = "";
      for (const n of arr) hex += n.toString(16);
      calls.set(hex.slice(0, 8), marker);
    }
    return result;
  };

  const pg = {
    /** Set the call-site marker after arguments are evaluated */
    m<T extends unknown[]>(loc: number, args: T): T {
      marker = loc;
      return args;
    },
    /** Pending await */
    a<T>(loc: number, value: T): Promise<Awaited<T>> {
      pending.set(loc, (pending.get(loc) ?? 0) + 1);
      const done = () => {
        const n = pending.get(loc)! - 1;
        if (n === 0) pending.delete(loc);
        else pending.set(loc, n);
      };
      return Promise.resolve(value).then(
        (v) => (done(), v),
        (e) => {
          done();
          throw e;
        },
      );
    },
    /** Statement reached */
    r(loc: number) {
      reached.set(loc, (reached.get(loc) ?? 0) + 1);
    },
  };

  const report = (requestIds: string[]): Report => {
    const enteredFns = new Set<number>([-1]);
    for (const s of inst.statements) if (reached.has(s.loc)) enteredFns.add(s.fn);
    return {
      ranges: inst.ranges,
      calls: Object.fromEntries(
        requestIds.flatMap((id) => {
          const loc = calls.get(id.split("::")[1] ?? "");
          return loc === undefined ? [] : [[id, loc]];
        }),
      ),
      pending: Object.fromEntries(pending),
      reached: Object.fromEntries(reached),
      notReached: inst.statements
        .filter((s) => !reached.has(s.loc) && enteredFns.has(s.fn))
        .map((s) => s.loc),
    };
  };

  return { pg, report };
}
