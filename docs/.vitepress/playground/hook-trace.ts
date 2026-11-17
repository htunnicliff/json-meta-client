import type { CapabilityOption, Config } from "../../../src/types.ts";

export interface HookTarget {
  kind: "batch" | "session" | "upload" | "download" | "eventSource";
  method: string;
  url: string;
}

export interface HookCall {
  name: keyof NonNullable<Config<readonly CapabilityOption[]>["hooks"]>;
  position: number;
  callback: string;
}

export type HookState = { status: "running" | "completed" } | { status: "failed"; error: unknown };

export interface HookTrace {
  update(call: HookCall, state: HookState): void;
  send(request: Request): void;
}

export type ObserveHooks = (target: HookTarget) => HookTrace;

/** Lets the docs playground observe a client without adding a public option. */
export const hookObservers: WeakMap<object, ObserveHooks> = new WeakMap();

export function callHook<Args, Result>(
  trace: HookTrace | undefined,
  name: HookCall["name"],
  index: number,
  hook: (args: Args) => Result | Promise<Result>,
  args: Args,
): Result | Promise<Result> {
  return trace
    ? callTracedHook(trace, { name, position: index + 1, callback: hook.name }, hook, args)
    : hook(args);
}

async function callTracedHook<Args, Result>(
  trace: HookTrace,
  call: HookCall,
  hook: (args: Args) => Result | Promise<Result>,
  args: Args,
): Promise<Result> {
  trace.update(call, { status: "running" });
  try {
    const result = await hook(args);
    trace.update(call, { status: "completed" });
    return result;
  } catch (error) {
    trace.update(call, { status: "failed", error });
    throw error;
  }
}
