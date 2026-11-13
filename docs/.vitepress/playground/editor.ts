/**
 * The playground's view of a code editor.
 *
 * The runner and anything built on it, such as source-line features and inline
 * embeds, depend on this interface rather than on Monaco, so they stay usable
 * without loading it.
 */
export interface PlaygroundEditor {
  /** The code as the editor holds it */
  getCode(): string;
  /** Replace the code, as when loading an example */
  setCode(code: string): void;
  /**
   * Listen for changes the user makes. Returns a function that stops
   * listening.
   */
  onChange(listener: (code: string) => void): () => void;
  /** Replace the highlighted lines */
  setDecorations(decorations: readonly EditorDecoration[]): void;
  /** Tear down the editor and everything it registered */
  dispose(): void;
}

/**
 * A line, or a range of lines, the editor highlights
 */
export interface EditorDecoration {
  /** The first line, zero-based */
  line: number;
  /** The last line, zero-based. Defaults to {@link line}. */
  endLine?: number;
  /** A CSS class name to add to the lines */
  className: string;
  /** Text to show when the decoration is hovered */
  hover?: string;
}
