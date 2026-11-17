import type { EditorDecoration, EditorRange } from "./editor.ts";
import type { SourcePosition, SourceRange } from "./instrument.ts";
import type { SourceLines } from "./source-lines.ts";

const toEditorRange = ({ start, end }: SourceRange): EditorRange => ({
  startLine: start.line,
  startColumn: start.column,
  endLine: end.line,
  endColumn: end.column,
});

/**
 * The editor's decorations for a run: greyed code that was not reached, a
 * badge on each line with a pending `await`, a label where each method call
 * was made, "not sent" on method calls in code that was not reached, a
 * highlight on the method calls hovered in the panel, and the connection
 * options a connected server replaces, struck through
 */
export function editorDecorations(
  lines: SourceLines | undefined,
  highlighted: ReadonlySet<string>,
  substituted: readonly SourceRange[] = [],
): EditorDecoration[] {
  const decorations: EditorDecoration[] = substituted.map((range, index) => ({
    range: toEditorRange(range),
    inlineClassName: "pg-substituted",
    hoverMessage: "Replaced by your connection at run time",
    // One note, after the last replaced value
    ...(index === substituted.length - 1 && {
      badge: {
        content: "replaced by your connection at run time",
        className: "pg-badge pg-badge-substituted",
      },
    }),
  }));
  if (!lines) return decorations;
  for (const range of lines.notReached) {
    decorations.push({ range: toEditorRange(range), inlineClassName: "pg-not-reached" });
  }
  for (const { range, count, calls } of lines.waiting) {
    const awaited = calls.map(({ label, name }) => `\`${name}\` (${label})`).join(", ");
    // Only the first line, where the `await` is
    const { line, column } = range.start;
    decorations.push({
      range: { startLine: line, startColumn: column, endLine: line, endColumn: column },
      lineClassName: "pg-waiting-line",
      badge: {
        content: count > 1 ? `waiting here ×${count}` : "waiting here",
        className: "pg-badge pg-badge-waiting",
      },
      hoverMessage: awaited ? `Waiting for a response to ${awaited}` : "Waiting for a response",
    });
  }
  // One label badge per call site, listing every call made there
  const labelsBySite = new Map<string, { range: SourceRange; labels: string[] }>();
  for (const [label, range] of Object.entries(lines.calls)) {
    const key = `${range.start.line}:${range.start.column}`;
    const site = labelsBySite.get(key) ?? { range, labels: [] };
    site.labels.push(label);
    labelsBySite.set(key, site);
  }
  for (const { range, labels } of labelsBySite.values()) {
    const hovered = labels.some((label) => highlighted.has(label));
    decorations.push({
      range: toEditorRange(range),
      ...(hovered ? { lineClassName: "pg-hovered-line" } : {}),
      badge: { content: labels.join(" "), className: "pg-badge pg-badge-call" },
    });
  }
  for (const { range, method } of lines.notSent) {
    decorations.push({
      range: toEditorRange(range),
      badge: { content: "not sent", className: "pg-badge pg-badge-not-sent" },
      hoverMessage: `\`${method}\` was not sent: the code waits for a response before reaching it`,
    });
  }
  return decorations;
}

/**
 * The labels of the method calls made at the innermost call site containing
 * `position`
 */
export function labelsAt(lines: SourceLines, position: SourcePosition): string[] {
  const containing = Object.entries(lines.calls).filter(([, range]) => contains(range, position));
  if (!containing.length) return [];
  const smallest = Math.min(...containing.map(([, range]) => size(range)));
  return containing.filter(([, range]) => size(range) === smallest).map(([label]) => label);
}

function size({ start, end }: SourceRange): number {
  return (end.line - start.line) * 10_000 + end.column - start.column;
}

function contains({ start, end }: SourceRange, { line, column }: SourcePosition): boolean {
  const after = line > start.line || (line === start.line && column >= start.column);
  const before = line < end.line || (line === end.line && column <= end.column);
  return after && before;
}
