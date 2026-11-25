import { syntaxTree } from "@codemirror/language";
import type { EditorState, Extension, Range } from "@codemirror/state";
import { Decoration, ViewPlugin, WidgetType } from "@codemirror/view";
import type { DecorationSet, EditorView, ViewUpdate } from "@codemirror/view";

import { placeholderFill } from "./placeholder-marks.ts";

// Code inside these runs when called, not where it is written
const DEFERRED = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunction",
  "ClassDeclaration",
  "ClassExpression",
]);

/**
 * Where the top-level statement holding the code's first top-level `await`
 * ends, or `undefined` when nothing waits
 */
export function firstAwaitEnd(state: EditorState): number | undefined {
  let end: number | undefined;
  syntaxTree(state).iterate({
    enter(node) {
      if (end !== undefined || DEFERRED.has(node.name)) {
        return false;
      }
      if (node.name !== "await") {
        return undefined;
      }
      let statement = node.node;
      while (statement.parent && statement.parent.name !== "Script") {
        statement = statement.parent;
      }
      end = statement.to;
      return false;
    },
  });
  return end;
}

const NOTE = "Connect a server to proceed";
const NOTE_TITLE = "Without a server, requests stay pending, so code after this await doesn't run.";

/** A note on why the code after it doesn't run */
class AwaitNote extends WidgetType {
  override eq() {
    return true;
  }

  override toDOM() {
    const span = document.createElement("span");
    span.className = "pg-await-note";
    span.textContent = `← ${NOTE}`;
    span.title = NOTE_TITLE;
    return span;
  }
}

const fadedLine = Decoration.line({ class: "pg-unreached-line" });

function decorations(state: EditorState): DecorationSet {
  if (state.field(placeholderFill)) {
    return Decoration.none;
  }
  const end = firstAwaitEnd(state);
  if (end === undefined) {
    return Decoration.none;
  }
  const { doc } = state;
  const ranges: Range<Decoration>[] = [
    Decoration.widget({ widget: new AwaitNote(), side: 1 }).range(doc.lineAt(end).to),
  ];
  for (let line = doc.lineAt(end).number + 1; line <= doc.lines; line++) {
    ranges.push(fadedLine.range(doc.line(line).from));
  }
  return Decoration.set(ranges, true);
}

const fade = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = decorations(view.state);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.startState.field(placeholderFill) !== update.state.field(placeholderFill) ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = decorations(update.state);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

/**
 * Without a connected server, fades the code past the first top-level `await`,
 * which never runs, and notes why
 */
export const awaitFade: Extension = fade;
