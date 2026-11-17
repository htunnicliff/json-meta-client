/**
 * What the playground needs from a code editor. The runner does not depend on
 * it, so pages can pair the runner with a lighter editor than Monaco.
 */
export interface CodeEditor {
  getCode(): string;
  /** Replace the code, as an edit the user can undo */
  setCode(code: string): void;
  /** Listen for changes to the code; returns a function that stops listening */
  onChange(listener: (code: string) => void): () => void;
  /** Replace every decoration this editor shows */
  setDecorations(decorations: readonly EditorDecoration[]): void;
  /**
   * Listen for the position the pointer is over, or `undefined` when it is
   * over no code; returns a function that stops listening
   */
  onHover(listener: (position: { line: number; column: number } | undefined) => void): () => void;
  setDark(dark: boolean): void;
  dispose(): void;
}

/**
 * A range of the code, with 1-based lines and columns
 */
export interface EditorRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface EditorDecoration {
  range: EditorRange;
  /** Applied to each whole line of the range */
  lineClassName?: string;
  /** Applied to the text of the range */
  inlineClassName?: string;
  /** A badge at the end of the range's first line */
  badge?: { content: string; className: string };
  /** Markdown shown on hover */
  hoverMessage?: string;
}
