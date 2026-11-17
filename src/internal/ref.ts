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

import type { ResultReferenceErrorReason } from "../errors/index.ts";
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

/**
 * A rule of RFC 8620 §3.7 that a method call's arguments break
 */
export interface ArgumentProblem {
  reason: Extract<ResultReferenceErrorReason, "nested" | "duplicate-argument">;
  /** JSON Pointer to the misplaced reference or the duplicated argument */
  path: string;
}

/**
 * Prefix the name of each top-level argument that is a result reference
 * with `#`, the only place RFC 8620 §3.7 lets a reference appear, and find
 * the first rule the arguments break: a reference nested inside an
 * argument's value, or an argument named both with and without `#`.
 */
export function prepareResultRefArguments(args: object): {
  args: Record<string, unknown>;
  problem?: ArgumentProblem;
} {
  const prepared: Record<string, unknown> = {};
  let problem: ArgumentProblem | undefined;
  for (const [key, value] of Object.entries(args)) {
    const name = isRef(value) ? `#${key}` : key;
    const plainName = name.replace(/^#/, "");
    if (
      Object.hasOwn(prepared, name) ||
      Object.hasOwn(prepared, name === plainName ? `#${name}` : plainName)
    ) {
      problem ??= { reason: "duplicate-argument", path: toPointer([plainName]) };
    }
    if (!isRef(value)) {
      const nested = findRef(value, [key]);
      if (nested) problem ??= { reason: "nested", path: toPointer(nested) };
    }
    prepared[name] = value;
  }
  return problem ? { args: prepared, problem } : { args: prepared };
}

/**
 * The path to the first result reference inside `value`, if any
 */
function findRef(value: unknown, path: string[]): string[] | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  for (const [key, item] of Object.entries(value)) {
    const itemPath = [...path, key];
    if (isRef(item)) return itemPath;
    const found = findRef(item, itemPath);
    if (found) return found;
  }
  return undefined;
}

/**
 * Join path segments into a JSON Pointer (RFC 6901)
 */
function toPointer(segments: string[]): string {
  return segments
    .map((segment) => `/${segment.replaceAll("~", "~0").replaceAll("/", "~1")}`)
    .join("");
}
