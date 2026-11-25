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

function escapePointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}
