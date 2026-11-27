import type { Patch } from "./rfc-types/core/index.ts";

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

const patchedValue = Symbol("patch");

/**
 * Change only some keys of an object in an update. As in JMAP, a plain
 * object in an update is the property's whole new value:
 * `mailboxIds: { [archiveId]: true }` puts the email in the archive only.
 * Wrap the object in `patch()` to change only the keys it names, and leave
 * the rest as they are. `null` removes a key.
 *
 * The client sends each key as a JSON Pointer path, such as
 * `mailboxIds/<id>`, escaping `~` and `/` in it. A value that is itself a
 * `patch()` is patched the same way, one level down.
 *
 * @example
 * await client.api.Email.set({
 *   update: {
 *     [emailId]: {
 *       mailboxIds: patch({ [inboxId]: null, [archiveId]: true }),
 *       keywords: patch({ $seen: true }),
 *     },
 *   },
 * });
 */
export function patch<const T extends object>(value: T): Patch<T> {
  // The symbol stands for the declared `Patch` brand
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return { [patchedValue]: value } as unknown as Patch<T>;
}

function isPatch(value: unknown): value is Record<typeof patchedValue, unknown> {
  return typeof value === "object" && value !== null && Object.hasOwn(value, patchedValue);
}

/**
 * Flatten an update into the JMAP wire form: each `patch()` becomes one
 * JSON Pointer path per key it names. Every other value is sent as it is.
 */
export function flattenPatch(update: unknown): unknown {
  if (typeof update !== "object" || update === null || Array.isArray(update)) {
    return update;
  }
  const flat: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(update)) {
    addPatch(flat, path, value);
  }
  return flat;
}

function addPatch(flat: Record<string, unknown>, path: string, value: unknown): void {
  if (!isPatch(value)) {
    flat[path] = value;
    return;
  }
  const entries: unknown = value[patchedValue];
  if (typeof entries !== "object" || entries === null) {
    throw new TypeError(`patch() at "${path}" must be given an object`);
  }
  for (const [key, item] of Object.entries(entries)) {
    addPatch(flat, `${path}/${escapePointerSegment(key)}`, item);
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
    if (typeof patches === "object" && patches !== null && !Array.isArray(patches)) {
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
