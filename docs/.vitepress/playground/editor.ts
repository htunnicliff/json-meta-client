import { autocompletion } from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
import { syntaxHighlighting } from "@codemirror/language";
import { Compartment, Prec, StateEffect, StateField } from "@codemirror/state";
import type { Extension, Range } from "@codemirror/state";
import { Decoration, EditorView, keymap, showPanel } from "@codemirror/view";
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

import { awaitFade } from "./await-fade.ts";
import { EDITOR_FILE } from "./editor-options.ts";
import type { SourcePosition } from "./instrument.ts";
import { placeholderMarks, setPlaceholderFill } from "./placeholder-marks.ts";
import type { PlaceholderFill } from "./placeholder-marks.ts";
import { formatTypeScript, minimalChange } from "./prettier.ts";

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
  /**
   * Format the code with Prettier, as an edit the user can undo. Resolves to
   * whether the code parsed; code that doesn't is left as is.
   */
  format(): Promise<boolean>;
  /** Switch the editor's optional behavior */
  configure(behavior: EditorBehavior): void;
  destroy(): void;
}

/**
 * What the user can switch on and off in the editor
 */
export interface EditorBehavior {
  /** Wrap lines longer than the editor is wide */
  wrapLines: boolean;
  /** Suggest completions as the user types, and on Ctrl-Space */
  suggestions: boolean;
  /** Show the type of what is under the pointer */
  typesOnHover: boolean;
}

export interface EditorOptions {
  code: string;
  behavior: EditorBehavior;
  /** The TypeScript worker that type-checks the code */
  worker: WorkerShape;
  onChange(code: string): void;
  /**
   * The position under the pointer, or at the cursor while the editor has
   * focus, or `undefined` when neither is over code
   */
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

const wrapping = new Compartment();
const completions = new Compartment();
const hovers = new Compartment();

/**
 * Each switchable behavior's compartment, with the extension for its setting.
 * `basicSetup` turns completion on, so switching suggestions off leaves it no
 * sources and no typing trigger.
 */
function behaviorParts({
  wrapLines,
  suggestions,
  typesOnHover,
}: EditorBehavior): [Compartment, Extension][] {
  return [
    [wrapping, wrapLines ? EditorView.lineWrapping : []],
    [
      completions,
      autocompletion(
        suggestions
          ? { override: [tsAutocompleteWorker()] }
          : { override: [], activateOnTyping: false },
      ),
    ],
    [hovers, typesOnHover ? tsHoverWorker() : []],
  ];
}

/**
 * A CodeMirror editor for TypeScript, with types, hovers and completions from
 * the playground's TypeScript worker
 */
export function createEditor(parent: HTMLElement, options: EditorOptions): CodeEditor {
  async function format(): Promise<boolean> {
    const before = view.state.doc.toString();
    let formatted;
    try {
      formatted = await formatTypeScript(before, view.state.selection.main.head);
    } catch {
      return false;
    }
    // The user typed while Prettier ran; their edit wins
    if (view.state.doc.toString() !== before) return true;
    const change = minimalChange(before, formatted.code);
    if (change) {
      view.dispatch({
        changes: change,
        selection: { anchor: Math.min(formatted.cursorOffset, formatted.code.length) },
        userEvent: "format",
      });
    }
    return true;
  }

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
      behaviorParts(options.behavior).map(([compartment, extension]) => compartment.of(extension)),
      highlighted,
      placeholderMarks,
      awaitFade,
      Prec.high(
        keymap.of([
          {
            key: "Shift-Alt-f",
            run: () => {
              void format();
              return true;
            },
          },
        ]),
      ),
      EditorView.contentAttributes.of({ "aria-label": "Code", "data-1p-ignore": "" }),
      EditorView.updateListener.of((update) => {
        // CodeMirror creates its Find, Replace, and Go to line fields when opening a panel.
        if (update.startState.facet(showPanel) !== update.state.facet(showPanel)) {
          const fields = update.view.dom.querySelectorAll(
            ":scope > .cm-panels input.cm-textfield:not([data-1p-ignore])",
          );
          for (const field of fields) {
            field.setAttribute("autocomplete", "off");
            field.setAttribute("data-1p-ignore", "");
          }
        }
        if (update.docChanged) options.onChange(update.state.doc.toString());
        // Keyboard users get the cursor's highlights, as pointer users get the hover's
        if ((update.selectionSet || update.focusChanged) && update.view.hasFocus) {
          const offset = update.state.selection.main.head;
          const line = update.state.doc.lineAt(offset);
          options.onHover({ line: line.number, column: offset - line.from + 1 });
        } else if (update.focusChanged) {
          options.onHover(undefined);
        }
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
    format,
    configure(behavior) {
      view.dispatch({
        effects: behaviorParts(behavior).map(([compartment, extension]) =>
          compartment.reconfigure(extension),
        ),
      });
    },
    setPlaceholderFill(fill) {
      view.dispatch({ effects: setPlaceholderFill.of(fill) });
    },
    destroy() {
      view.destroy();
    },
  };
}
