// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { JsonValue } from "type-fest";

import { isRef } from "../ref.ts";

/**
 * Recursively detect any objects containing result references,
 * updating their keys to use a # prefix
 */
export function replaceNestedResultRefKeys(payload: JsonValue): JsonValue {
  if (Array.isArray(payload)) {
    return payload.map((item) => replaceNestedResultRefKeys(item));
  }

  if (typeof payload === "object" && payload !== null) {
    return Object.fromEntries(
      Object.entries(payload).map(([key, value]) => {
        if (isRef(value)) {
          return [`#${key}`, value];
        }

        return [key, replaceNestedResultRefKeys(value)];
      }),
    );
  }

  return payload;
}
