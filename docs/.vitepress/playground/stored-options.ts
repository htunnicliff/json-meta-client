/**
 * On-or-off options, each with a default and a label for its menu
 */
export interface OptionSet<Options extends { [Key in keyof Options]: boolean }> {
  defaults: Options;
  /** The options' labels, in menu order */
  labels: Record<keyof Options, string>;
  /** Where this browser keeps the options last chosen */
  storageKey: string;
}

/**
 * The options' keys, in menu order
 */
export function optionKeys<Options extends { [Key in keyof Options]: boolean }>(
  set: OptionSet<Options>,
): (keyof Options & string)[] {
  return Object.keys(set.labels).filter((key): key is keyof Options & string =>
    Object.hasOwn(set.defaults, key),
  );
}

/**
 * The options last chosen in this browser, over the defaults
 */
export function loadOptions<Options extends { [Key in keyof Options]: boolean }>(
  set: OptionSet<Options>,
): Options {
  const options = { ...set.defaults };
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(set.storageKey) ?? "{}");
    if (typeof stored !== "object" || stored === null) {
      return options;
    }
    const keys = new Set<string>(optionKeys(set));
    for (const [key, value] of Object.entries(stored)) {
      if (keys.has(key) && typeof value === "boolean") {
        Object.assign(options, { [key]: value });
      }
    }
  } catch {
    // Storage can be unavailable, or hold something else; the defaults stand
  }
  return options;
}

export function saveOptions<Options extends { [Key in keyof Options]: boolean }>(
  set: OptionSet<Options>,
  options: Options,
): void {
  try {
    localStorage.setItem(set.storageKey, JSON.stringify(options));
  } catch {
    // Storage can be unavailable, as in a private window; the options last the visit
  }
}
