// oxlint-disable unicorn/no-thenable
import type { ExtendedJSONPointer, Invocation, ResultReference } from "jmap-rfc-types";

import { ref } from "./ref.ts";

interface MethodCallParams<T> {
  readonly method: string;
  readonly args: T;
  readonly id?: string;
}

export class MethodCall<T> implements MethodCallParams<T> {
  constructor(params: MethodCallParams<T>) {
    this.method = params.method;
    this.args = params.args;
    this.id = params.id ?? `${params.method}::${crypto.randomUUID()}`;
  }

  readonly method: string;
  readonly args: T;
  readonly id: string;

  toInvocation = (): Invocation<T> => {
    return [this.method, this.args, this.id];
  };

  ref = (pointer: ExtendedJSONPointer): ResultReference => {
    return ref(this, pointer);
  };
}

export class MethodCallResult<T> {
  constructor(result: Invocation<T>) {
    this.method = result[0];
    this.data = result[1];
    this.id = result[2];
  }

  readonly method: string;
  readonly data: T;
  readonly id: string;
}
