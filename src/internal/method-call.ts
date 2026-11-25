import type { Invocation } from "../rfc-types/core/index.ts";

interface MethodCallParams<T> {
  readonly method: string;
  readonly args: T;
  readonly id: string;
}

export class MethodCall<T extends object> implements MethodCallParams<T> {
  constructor(params: MethodCallParams<T>) {
    if (typeof params.id !== "string") {
      throw new TypeError("Method call IDs must be strings");
    }
    this.method = params.method;
    this.args = params.args;
    this.id = params.id;
  }

  readonly method: string;
  readonly args: T;
  readonly id: string;

  toInvocation = (): Invocation<T> => {
    return [this.method, this.args, this.id];
  };
}
