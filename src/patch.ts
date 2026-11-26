import type { Replace } from "./rfc-types/core/index.ts";

/**
 * The paths of a patch object that end in a map's key, such as
 * `mailboxIds` in `` `mailboxIds/${string}` ``. A literal path such as
 * `keywords/$seen` has no variable segment, so it is not one.
 */
export type PatchMapPath<Patch> = MapPrefix<keyof Patch & string>;

type MapPrefix<Key extends string> = Key extends `${infer Head}/${infer Rest}`
  ? string extends Rest
    ? Head
    : MapPrefix<Rest> extends infer Tail extends string
      ? `${Head}/${Tail}`
      : never
  : never;

/**
 * The value a patch sets at one key of the map at `Path`
 */
export type PatchMapValue<Patch, Path extends string> = {
  [Key in keyof Patch]-?: Key extends `${Path}/${string}`
    ? `${Path}/${string}` extends Key
      ? Exclude<Patch[Key], undefined>
      : never
    : never;
}[keyof Patch];

/**
 * Patch entries of a map keyed by ID, such as an email's `mailboxIds`, as
 * one patch path per key. Each key is escaped as a JSON Pointer segment, so
 * `~` becomes `~0` and `/` becomes `~1`.
 *
 * The patch type comes from where the result is used, such as an entry of
 * a `/set` call's `update`, so `path` must name a map that type has, and
 * each value must be one the map accepts. Spread the result to combine it
 * with other paths.
 *
 * @example
 * await client.api.Email.set({
 *   update: {
 *     [emailId]: {
 *       ...patchMap("mailboxIds", { [inboxId]: null, [archiveId]: true }),
 *       "keywords/$seen": true,
 *     },
 *   },
 * });
 */
export function patchMap<Patch, const Path extends PatchMapPath<Patch>>(
  path: Path,
  entries: Readonly<Record<string, PatchMapValue<Patch, Path>>>,
): Patch {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entries)) {
    patch[`${path}/${escapePointerSegment(key)}`] = value;
  }
  // The types checked `path` and each value against `Patch`
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return patch as Patch;
}

const replacedValue = Symbol("replace");

/**
 * Set an object whole in an update, instead of patching only the keys it
 * names. A plain object in an update is a patch: `mailboxIds: { [id]: true }`
 * adds the email to one mailbox and leaves its others. Wrap it in
 * `replace()` to send the object as the property's new value, so that the
 * email is in that mailbox only.
 *
 * @example
 * await client.api.Email.set({
 *   update: {
 *     [emailId]: { mailboxIds: replace({ [archiveId]: true }) },
 *   },
 * });
 */
export function replace<const T extends object>(value: T): Replace<T> {
  // The symbol stands for the declared `Replace` brand
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return { [replacedValue]: value } as unknown as Replace<T>;
}

function isReplace(value: unknown): value is Record<typeof replacedValue, unknown> {
  return typeof value === "object" && value !== null && Object.hasOwn(value, replacedValue);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Flatten an update into the JMAP wire form. A key with a `/` is already a
 * JSON Pointer path, and its value is kept as it is. A plain object under any
 * other key is patched key by key: its keys become path segments, escaped as
 * JSON Pointer requires, down to the first value that isn't a plain object.
 * `replace()` stops the descent and sends its value whole.
 */
export function flattenPatch(patch: unknown): unknown {
  if (!isPlainObject(patch)) {
    return patch;
  }
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key.includes("/")) {
      flat[key] = isReplace(value) ? value[replacedValue] : value;
    } else {
      addNestedPatch(flat, key, value);
    }
  }
  return flat;
}

function addNestedPatch(flat: Record<string, unknown>, path: string, value: unknown): void {
  if (isReplace(value)) {
    flat[path] = value[replacedValue];
  } else if (isPlainObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      addNestedPatch(flat, `${path}/${escapePointerSegment(key)}`, item);
    }
  } else {
    flat[path] = value;
  }
}

/**
 * Flatten every patch in a method call's arguments: each entry of a `/set`
 * call's `update`, and each entry of `onSuccessUpdateEmail`, which
 * `EmailSubmission/set` and `MDN/send` take
 */
export function flattenPatchArguments(method: string, args: object): object {
  const keys = method.endsWith("/set")
    ? ["update", "onSuccessUpdateEmail"]
    : ["onSuccessUpdateEmail"];
  let result: Record<string, unknown> | undefined;
  for (const key of keys) {
    const patches: unknown = Reflect.get(args, key);
    if (isPlainObject(patches)) {
      result ??= { ...args };
      result[key] = Object.fromEntries(
        Object.entries(patches).map(([id, patch]) => [id, flattenPatch(patch)]),
      );
    }
  }
  return result ?? args;
}

function escapePointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}
