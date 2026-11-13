import * as monaco from "monaco-editor/editor/editor.main";
// oxlint-disable-next-line import/default -- Vite's ?worker modules export a constructor at runtime
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
// oxlint-disable-next-line import/default, import/no-named-as-default -- Vite's ?worker modules export a constructor at runtime
import TypeScriptWorker from "monaco-editor/languages/features/typescript/ts.worker?worker";
import declarations from "virtual:json-meta-client-declarations";

import { playgroundCompilerOptions } from "./compiler-options.ts";
import type { EditorDecoration, PlaygroundEditor } from "./editor.ts";

declare global {
  // oxlint-disable-next-line no-var -- Monaco reads this global
  var MonacoEnvironment: { getWorker(moduleId: string, label: string): Worker } | undefined;
}

self.MonacoEnvironment = {
  getWorker(_moduleId, label) {
    return label === "typescript" || label === "javascript"
      ? new TypeScriptWorker()
      : new EditorWorker();
  },
};

let configured = false;

export interface MonacoEditorOptions {
  /** The element the editor fills */
  container: HTMLElement;
  /** The code to start with */
  code: string;
}

/**
 * Create a Monaco editor with the library's types in scope.
 *
 * This module is imported lazily, so the editor, its workers, and the
 * declarations load on `/playground` only.
 */
export function createMonacoEditor({ container, code }: MonacoEditorOptions): PlaygroundEditor {
  configure();
  applyTheme();

  const model = monaco.editor.createModel(
    code,
    "typescript",
    monaco.Uri.parse("file:///example.ts"),
  );
  const editor = monaco.editor.create(container, {
    model,
    ariaLabel: "Playground TypeScript code",
    automaticLayout: true,
    fontFamily: getComputedStyle(document.body).getPropertyValue("--vp-font-family-mono"),
    fontSize: 13,
    lineHeight: 21,
    minimap: { enabled: false },
    padding: { top: 12, bottom: 12 },
    renderLineHighlight: "none",
    scrollBeyondLastLine: false,
    tabSize: 2,
  });

  const listeners = new Set<(code: string) => void>();
  const subscription = editor.onDidChangeModelContent(() => {
    const next = editor.getValue();
    for (const listener of listeners) listener(next);
  });
  const stopWatchingTheme = watchTheme(applyTheme);
  let decorations: readonly string[] = [];

  return {
    getCode: () => editor.getValue(),
    setCode(next) {
      if (editor.getValue() !== next) editor.setValue(next);
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setDecorations(next: readonly EditorDecoration[]) {
      decorations = editor.deltaDecorations(
        decorations,
        next.map(({ line, endLine = line, className, hover }) => ({
          range: new monaco.Range(line + 1, 1, endLine + 1, 1),
          options: {
            isWholeLine: true,
            className,
            hoverMessage: hover ? { value: hover } : undefined,
          },
        })),
      );
    },
    dispose() {
      stopWatchingTheme();
      subscription.dispose();
      editor.dispose();
      model.dispose();
    },
  };
}

/**
 * Install the library's declarations and compiler options once per page
 */
function configure(): void {
  if (configured) return;
  configured = true;

  const typescript = monaco.languages.typescript;
  typescript.typescriptDefaults.setCompilerOptions({
    target: typescript.ScriptTarget[playgroundCompilerOptions.target],
    module: typescript.ModuleKind[playgroundCompilerOptions.module],
    moduleResolution: typescript.ModuleResolutionKind[playgroundCompilerOptions.moduleResolution],
    strict: playgroundCompilerOptions.strict,
    noUncheckedIndexedAccess: playgroundCompilerOptions.noUncheckedIndexedAccess,
    allowNonTsExtensions: true,
    lib: ["esnext", "dom", "dom.iterable"],
  });
  typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });

  for (const { path, content } of declarations) {
    typescript.typescriptDefaults.addExtraLib(content, path);
  }
}

/**
 * Follow the docs site's light and dark modes, including when the user
 * toggles the theme
 */
function applyTheme(): void {
  const dark = document.documentElement.classList.contains("dark");
  const styles = getComputedStyle(document.documentElement);
  const name = dark ? "json-meta-client-dark" : "json-meta-client-light";
  monaco.editor.defineTheme(name, {
    base: dark ? "vs-dark" : "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": color(styles, "--vp-c-bg"),
      "editor.foreground": color(styles, "--vp-c-text-1"),
      "editorCursor.foreground": color(styles, "--vp-c-brand-1"),
      "editorLineNumber.foreground": color(styles, "--vp-c-text-3"),
      "editor.selectionBackground": color(styles, "--vp-c-brand-soft"),
    },
  });
  monaco.editor.setTheme(name);
}

function color(styles: CSSStyleDeclaration, property: string): string {
  return styles.getPropertyValue(property).trim();
}

function watchTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
