import { autocompletion } from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
import { syntaxHighlighting } from "@codemirror/language";
import { StateEffect, StateField } from "@codemirror/state";
import type { Range } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import { classHighlighter } from "@lezer/highlight";
import {
  tsAutocompleteWorker,
  tsFacetWorker,
  tsHoverWorker,
  tsLinterWorker,
  tsSyncWorker,
} from "@valtown/codemirror-ts";
import type { WorkerShape } from "@valtown/codemirror-ts/worker";
import { basicSetup } from "codemirror";

import { EDITOR_FILE } from "./editor-options.ts";
import type { SourcePosition } from "./instrument.ts";
import { placeholderMarks, setPlaceholderFill } from "./placeholder-marks.ts";
import type { PlaceholderFill } from "./placeholder-marks.ts";

/**
 * Lines of the code, 1-based and inclusive
 */
export interface LineRange {
  from: number;
  to: number;
}

export interface CodeEditor {
  /** Replace the code, as an edit the user can undo */
  setCode(code: string): void;
  /** Highlight these lines, replacing any lines highlighted before */
  highlight(ranges: readonly LineRange[]): void;
  /** Show what fills in the code's placeholders: a connected server, or none */
  setPlaceholderFill(fill: PlaceholderFill | undefined): void;
  destroy(): void;
}

export interface EditorOptions {
  code: string;
  /** The TypeScript worker that type-checks the code */
  worker: WorkerShape;
  onChange(code: string): void;
  /** The position under the pointer, or `undefined` when it is over no code */
  onHover(position: SourcePosition | undefined): void;
}

const setHighlight = StateEffect.define<readonly LineRange[]>();
const hoveredLine = Decoration.line({ class: "pg-hovered-line" });

const highlighted = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    let next = decorations.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (!effect.is(setHighlight)) continue;
      const { doc } = transaction.state;
      const lines: Range<Decoration>[] = [];
      for (const { from, to } of effect.value) {
        for (let line = from; line <= Math.min(to, doc.lines); line++) {
          lines.push(hoveredLine.range(doc.line(line).from));
        }
      }
      next = Decoration.set(lines, true);
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/**
 * A CodeMirror editor for TypeScript, with types, hovers and completions from
 * the playground's TypeScript worker
 */
export function createEditor(parent: HTMLElement, options: EditorOptions): CodeEditor {
  const view = new EditorView({
    parent,
    doc: options.code,
    extensions: [
      basicSetup,
      javascript({ typescript: true }),
      syntaxHighlighting(classHighlighter),
      tsFacetWorker.of({ worker: options.worker, path: EDITOR_FILE }),
      tsSyncWorker(),
      tsLinterWorker(),
      autocompletion({ override: [tsAutocompleteWorker()] }),
      tsHoverWorker(),
      highlighted,
      placeholderMarks,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) options.onChange(update.state.doc.toString());
      }),
      EditorView.domEventHandlers({
        mousemove(event, editor) {
          const offset = editor.posAtCoords({ x: event.clientX, y: event.clientY }, false);
          const line = editor.state.doc.lineAt(offset);
          options.onHover({ line: line.number, column: offset - line.from + 1 });
        },
        mouseleave() {
          options.onHover(undefined);
        },
      }),
    ],
  });

  return {
    setCode(code) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } });
    },
    highlight(ranges) {
      view.dispatch({ effects: setHighlight.of(ranges) });
    },
    setPlaceholderFill(fill) {
      view.dispatch({ effects: setPlaceholderFill.of(fill) });
    },
    destroy() {
      view.destroy();
    },
  };
}
