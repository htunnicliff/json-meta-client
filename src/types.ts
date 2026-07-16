import type { MethodCall } from "./method-calls.ts";

export interface GlobalMethodCalls {
  //
}

export type GlobalEntity = keyof GlobalMethodCalls;

/**
 * The asynchronous, promise-returning view of {@link GlobalMethodCalls} exposed
 * by the client proxy. Every method keeps its argument types but returns a
 * promise of its result, since calls are dispatched over the network.
 *
 * Only entities unlocked by the client's configured capabilities appear.
 */
export type Api = {
  [E in GlobalEntity]: {
    [Method in keyof GlobalMethodCalls[E]]: GlobalMethodCalls[E][Method] extends (
      ...args: infer Args
    ) => infer Result
      ? (...args: Args) => MethodCall<Args, Result>
      : never;
  };
};
