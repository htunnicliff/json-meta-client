import type { Invocation } from "jmap-rfc-types";

import { randomHex } from "./random-hex.ts";

interface MethodCallParams<T> {
  readonly method: string;
  readonly args: T;
  readonly id?: string;
}

export class MethodCall<T> implements MethodCallParams<T> {
  constructor(params: MethodCallParams<T>) {
    this.method = params.method;
    this.args = params.args;
    this.id = params.id ?? `${params.method}::${randomHex(8)}`;
  }

  readonly method: string;
  readonly args: T;
  readonly id: string;

  toInvocation = (): Invocation<T> => {
    return [this.method, this.args, this.id];
  };
}
