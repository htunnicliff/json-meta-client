// oxlint-disable unicorn/no-thenable
import type { Invocation } from "jmap-rfc-types";

interface MethodCallParams<T> {
  readonly method: string;
  readonly args: T;
  readonly id: string;
}

export class MethodCall<T, Result> implements MethodCallParams<T>, PromiseLike<Result> {
  constructor(params: MethodCallParams<T>) {
    this.method = params.method;
    this.args = params.args;
    this.id = params.id;
  }

  readonly method: string;
  readonly args: T;
  readonly id: string;

  #promise = Promise.withResolvers<Result>();

  reject = this.#promise.reject.bind(this);

  resolve = this.#promise.resolve.bind(this);

  get promise() {
    return this.#promise.promise;
  }

  toInvocation(): Invocation<T> {
    return [this.method, this.args, this.id];
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.#promise.promise.then(onfulfilled, onrejected);
  }
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
