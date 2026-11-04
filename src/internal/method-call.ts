/**
 * Copyright (c) 2026 Hunter Tunnicliff
 *
 * This source code is subject to the terms of the Mozilla Public
 * License, version 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 */

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
