// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

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
