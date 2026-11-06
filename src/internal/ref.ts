// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { IsUnknown } from "type-fest";

import type { ResultReference } from "../rfc-types/core/index.ts";
import type { ExtractByPointer, PointerPaths } from "./types.ts";

const refSymbol: unique symbol = Symbol("ref");

/**
 * A JMAP result reference carrying the type extracted by its JSON Pointer.
 */
export type Ref<T = unknown> = ResultReference & {
  readonly [refSymbol]: true;
  /** Phantom carrier for the type at `path`. */
  readonly __type?: T;
};

export type ResultRefFn<Output> = <
  const Pointer extends (IsUnknown<Output> extends true ? `/${string}` : PointerPaths<Output>),
>(
  pointer: Pointer,
) => Ref<ExtractByPointer<Output, Pointer>>;

export type WithResultRefFn<T extends object, Output> = T & {
  resultRef: ResultRefFn<Output>;
};

export function isRef(input: unknown): input is Ref {
  return typeof input === "object" && input !== null && Object.hasOwn(input, refSymbol);
}

/**
 * Augment an object with the #resultRef() method for a given method call
 */
export function addRefMethod<Output, T extends object>(
  obj: T,
  { name, resultOf }: Pick<ResultReference, "name" | "resultOf">,
): WithResultRefFn<T, Output> {
  const resultRef: ResultRefFn<Output> = (pointer) => {
    return {
      name,
      resultOf,
      path: pointer,
      [refSymbol]: true,
    };
  };

  return Object.assign(obj, { resultRef });
}
