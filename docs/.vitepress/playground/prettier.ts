/**
 * Code formatted with Prettier, and where the cursor moved to
 */
export interface Formatted {
  code: string;
  cursorOffset: number;
}

/**
 * Format TypeScript with Prettier, loading it on first use. Rejects when the
 * code doesn't parse.
 */
export async function formatTypeScript(code: string, cursorOffset: number): Promise<Formatted> {
  const [{ formatWithCursor }, typescript, estree] = await Promise.all([
    import("prettier/standalone"),
    import("prettier/plugins/typescript"),
    import("prettier/plugins/estree"),
  ]);
  const { formatted, cursorOffset: cursor } = await formatWithCursor(code, {
    parser: "typescript",
    plugins: [typescript, estree],
    cursorOffset,
  });
  return { code: formatted, cursorOffset: Math.max(cursor, 0) };
}

/**
 * The smallest single change that turns `before` into `after`: the text
 * between their common prefix and suffix
 */
export function minimalChange(
  before: string,
  after: string,
): { from: number; to: number; insert: string } | undefined {
  if (before === after) return undefined;
  let start = 0;
  const shorter = Math.min(before.length, after.length);
  while (start < shorter && before[start] === after[start]) start++;
  let end = 0;
  while (
    end < shorter - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  ) {
    end++;
  }
  return {
    from: start,
    to: before.length - end,
    insert: after.slice(start, after.length - end),
  };
}
