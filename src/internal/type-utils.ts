// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

/**
 * General-purpose type helpers. They are adapted from type-fest
 * (https://github.com/sindresorhus/type-fest), simplified to the cases this
 * library needs, so that its public types don't depend on another package.
 *
 * type-fest is licensed under "MIT OR CC0-1.0"; this library uses it under
 * CC0-1.0, which needs no notice. Its MIT notice is kept here anyway.
 *
 * cspell:ignore Sindre Sorhus
 *
 * MIT License
 *
 * Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

/** A JSON primitive. */
export type JsonPrimitive = string | number | boolean | null;

/** A JSON object. */
export type JsonObject = { [Key in string]: JsonValue };

/** A JSON array. */
export type JsonArray = JsonValue[] | readonly JsonValue[];

/** Any JSON value. */
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

/** `true` when `T` is `unknown`, and `false` for every other type, including `any`. */
export type IsUnknown<T> = unknown extends T ? ([T] extends [null] ? false : true) : false;

/** Convert a union into an intersection of its members. */
export type UnionToIntersection<Union> = (
  Union extends unknown ? (distributedUnion: Union) => void : never
) extends (mergedIntersection: infer Intersection) => void
  ? Intersection & Union
  : never;

/** Every key of every member of a union, unlike `keyof`, which keeps only shared keys. */
export type KeysOfUnion<T> = keyof UnionToIntersection<
  T extends unknown ? Record<keyof T, never> : never
>;

/** The element type of an array or tuple. */
export type ArrayElement<T> = T extends readonly unknown[] ? T[number] : never;

/** Flatten an intersection into a single object type, for readability. */
// oxlint-disable-next-line typescript/no-empty-object-type
export type Simplify<T> = { [Key in keyof T]: T[Key] } & {};

/** `T` without `Keys`, keeping the modifiers of the other keys. */
type Except<T, Keys extends keyof T> = {
  [Key in keyof T as Key extends Keys ? never : Key]: T[Key];
};

/** `T` with only `Keys`, keeping their modifiers. */
type HomomorphicPick<T, Keys extends keyof T> = {
  [Key in keyof T as Extract<Key, Keys>]: T[Key];
};

/** `T` with `Keys` made optional. */
export type SetOptional<T, Keys extends keyof T> = Simplify<
  Except<T, Keys> & Partial<HomomorphicPick<T, Keys>>
>;

/** `T` with `Keys` made required. */
export type SetRequired<T, Keys extends keyof T> = Simplify<
  Except<T, Keys> & Required<HomomorphicPick<T, Keys>>
>;

/** `Omit`, applied to each member of a union separately. */
export type DistributedOmit<T, Keys extends KeysOfUnion<T>> = T extends unknown
  ? Omit<T, Keys>
  : never;

/** `T`, with at least one of `Keys` required. */
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = {
  [Key in Keys]-?: Required<Pick<T, Key>> & Partial<Pick<T, Exclude<Keys, Key>>>;
}[Keys] &
  Except<T, Keys>;
