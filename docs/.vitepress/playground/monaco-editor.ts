import { editor as monacoEditor, typescript, Uri } from "monaco-editor";
// Vite's `?worker` imports have a default export that the lint rules can't see
// oxlint-disable-next-line import/default
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
// oxlint-disable-next-line import/default, import/no-named-as-default
import TsWorker from "monaco-editor/languages/features/typescript/ts.worker?worker";
import typeFiles from "virtual:playground-types";

import { EDITOR_FILE, editorCompilerOptions } from "./editor-options.ts";
import type { CodeEditor, EditorDecoration } from "./editor.ts";

/**
 * Monaco with a TypeScript language service that knows the library's types.
 * Loaded only by the playground page.
 */

Object.assign(globalThis, {
  MonacoEnvironment: {
    getWorker: (_id: string, label: string) =>
      label === "typescript" || label === "javascript" ? new TsWorker() : new EditorWorker(),
  },
});

let configured = false;

function configureTypeScript() {
  if (configured) return;
  configured = true;
  const defaults = typescript.typescriptDefaults;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  defaults.setCompilerOptions(editorCompilerOptions as unknown as typescript.CompilerOptions);
  defaults.setEagerModelSync(true);
  for (const [file, text] of Object.entries(typeFiles)) {
    defaults.addExtraLib(text, `file:///${file}`);
  }
}

/**
 * Monaco's themes on the docs site's backgrounds (`--vp-c-bg`)
 */
function defineThemes() {
  monacoEditor.defineTheme("vp-light", {
    base: "vs",
    inherit: true,
    rules: [],
    colors: { "editor.background": "#ffffff" },
  });
  monacoEditor.defineTheme("vp-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: { "editor.background": "#1b1b1f" },
  });
}

export function createMonacoEditor(
  element: HTMLElement,
  { code, dark }: { code: string; dark: boolean },
): CodeEditor {
  configureTypeScript();
  defineThemes();
  const model =
    monacoEditor.getModel(Uri.parse(EDITOR_FILE)) ??
    monacoEditor.createModel(code, "typescript", Uri.parse(EDITOR_FILE));
  model.setValue(code);
  const editor = monacoEditor.create(element, {
    model,
    theme: dark ? "vp-dark" : "vp-light",
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 14,
    lineHeight: 22,
    tabSize: 2,
    fixedOverflowWidgets: true,
    padding: { top: 12, bottom: 12 },
    renderLineHighlight: "none",
    "semanticHighlighting.enabled": true,
  });
  const decorations = editor.createDecorationsCollection();

  return {
    getCode: () => model.getValue(),
    setCode(next) {
      if (next === model.getValue()) return;
      editor.pushUndoStop();
      editor.executeEdits("playground", [{ range: model.getFullModelRange(), text: next }]);
      editor.pushUndoStop();
    },
    onChange(listener) {
      const subscription = model.onDidChangeContent(() => listener(model.getValue()));
      return () => subscription.dispose();
    },
    setDecorations(next: readonly EditorDecoration[]) {
      decorations.set(
        next.map(({ range, lineClassName, inlineClassName, after, hoverMessage }) => ({
          range: {
            startLineNumber: range.startLine,
            startColumn: range.startColumn,
            endLineNumber: range.endLine,
            endColumn: range.endColumn,
          },
          options: {
            className: lineClassName,
            isWholeLine: Boolean(lineClassName),
            inlineClassName,
            after: after && { content: after.content, inlineClassName: after.className },
            hoverMessage: hoverMessage === undefined ? undefined : { value: hoverMessage },
          },
        })),
      );
    },
    setDark(next) {
      monacoEditor.setTheme(next ? "vp-dark" : "vp-light");
    },
    dispose() {
      editor.dispose();
      model.dispose();
    },
  };
}
