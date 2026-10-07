import type { Invocation } from "jmap-rfc-types";

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
