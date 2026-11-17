import { syntaxTree } from "@codemirror/language";
import { StateEffect, StateField } from "@codemirror/state";
import type { EditorState, Extension, Range } from "@codemirror/state";
import { Decoration, ViewPlugin, WidgetType } from "@codemirror/view";
import type { DecorationSet, EditorView, ViewUpdate } from "@codemirror/view";

import {
  hasServerPlaceholder,
  PLACEHOLDER_ORIGIN,
  SERVER_PLACEHOLDER,
  TOKEN_PLACEHOLDER,
} from "../recorder/index.ts";

type SyntaxNode = ReturnType<typeof syntaxTree>["topNode"];

/**
 * The connected server that fills in the code's placeholders
 */
export interface PlaceholderFill {
  sessionUrl: string;
  credentials: "token" | "password";
}

/** Set or clear the connected server */
export const setPlaceholderFill = StateEffect.define<PlaceholderFill | undefined>();

const fill = StateField.define<PlaceholderFill | undefined>({
  create: () => undefined,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setPlaceholderFill)) value = effect.value;
    }
    return value;
  },
});

/** A short note after a placeholder, on what fills it in */
class FillWidget extends WidgetType {
  constructor(
    readonly text: string,
    readonly title: string,
  ) {
    super();
  }

  override eq(other: FillWidget) {
    return other.text === this.text && other.title === this.title;
  }

  override toDOM() {
    const span = document.createElement("span");
    span.className = "pg-fill";
    span.textContent = `→ ${this.text}`;
    span.title = this.title;
    return span;
  }
}

function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

// The option a string is the value of, as in `sessionUrl: "…"`
function propertyName(state: EditorState, string: SyntaxNode): string | undefined {
  const property = string.parent;
  if (property?.name !== "Property") return undefined;
  const key = property.firstChild;
  return key?.name === "PropertyDefinition" ? state.sliceDoc(key.from, key.to) : undefined;
}

function decorations(state: EditorState): DecorationSet {
  const server = state.field(fill);
  const ranges: Range<Decoration>[] = [];
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== "String") return;
      const value = state.sliceDoc(node.from + 1, node.to - 1);
      const name = propertyName(state, node.node);
      let title: string;
      let widget: FillWidget | undefined;
      if (name === "sessionUrl" && hasServerPlaceholder(value)) {
        title = server
          ? `Placeholder, filled in with ${server.sessionUrl}`
          : `Placeholder. The playground mocks ${SERVER_PLACEHOLDER} as ${PLACEHOLDER_ORIGIN}; connect a server to fill it in.`;
        if (server) widget = new FillWidget(host(server.sessionUrl), title);
      } else if (name === "auth" && value === TOKEN_PLACEHOLDER) {
        const credentials = server?.credentials === "password" ? "your password" : "your token";
        title = server
          ? `Placeholder, filled in with ${credentials} from the connected server`
          : "Placeholder. Connect a server to fill it in with your credentials.";
        if (server) widget = new FillWidget(credentials, title);
      } else {
        return;
      }
      ranges.push(
        Decoration.mark({ class: "pg-placeholder", attributes: { title } }).range(
          node.from,
          node.to,
        ),
      );
      // At the end of the line, past any comma
      if (widget) {
        ranges.push(Decoration.widget({ widget, side: 1 }).range(state.doc.lineAt(node.to).to));
      }
    },
  });
  return Decoration.set(ranges, true);
}

const marks = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = decorations(view.state);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.startState.field(fill) !== update.state.field(fill) ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = decorations(update.state);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

/**
 * Marks the `<server>` and `<token>` placeholders of client options, with a
 * note on what fills them in while a server is connected
 */
export const placeholderMarks: Extension = [fill, marks];
