import type ts from "typescript";

const PACKAGE = "json-meta-client";

export class TranspileError extends Error {
  override name = "TranspileError";
}

let typescript: Promise<typeof ts> | undefined;

/**
 * The TypeScript compiler API, which is large and only needed once a run
 * starts. Loading it once per worker keeps later runs fast.
 */
export function loadTypeScript(): Promise<typeof ts> {
  typescript ??= import("typescript").then(
    (module) => (module as { default?: typeof ts }).default ?? module,
  );
  return typescript;
}

/**
 * Strip types from user code and point its `json-meta-client` imports at
 * `shimUrl`. Any other import is an error: the playground runs code on its
 * own, not with a package manager.
 */
export async function transpile(source: string, shimUrl: string): Promise<string> {
  const compiler = await loadTypeScript();
  const { outputText, diagnostics } = compiler.transpileModule(source, {
    fileName: "example.ts",
    reportDiagnostics: true,
    compilerOptions: {
      target: compiler.ScriptTarget.ESNext,
      module: compiler.ModuleKind.ESNext,
      verbatimModuleSyntax: false,
    },
  });
  if (diagnostics?.length) throw new TranspileError(formatDiagnostics(compiler, diagnostics));
  return rewriteImports(compiler, outputText, shimUrl);
}

function formatDiagnostics(typescript: typeof ts, diagnostics: readonly ts.Diagnostic[]): string {
  return diagnostics
    .map((diagnostic) => {
      const position =
        diagnostic.file && diagnostic.start !== undefined
          ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
          : undefined;
      const where = position ? `${position.line + 1}:${position.character + 1}: ` : "";
      const message = typescript.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
      return `${where}TS${diagnostic.code}: ${message}`;
    })
    .join("\n");
}

function rewriteImports(typescript: typeof ts, code: string, shimUrl: string): string {
  const file = typescript.createSourceFile(
    "example.js",
    code,
    typescript.ScriptTarget.ESNext,
    false,
    typescript.ScriptKind.JS,
  );
  const specifiers: ts.StringLiteralLike[] = [];
  const visit = (node: ts.Node): void => {
    const specifier = moduleSpecifier(typescript, node);
    if (specifier) {
      if (specifier.text !== PACKAGE) {
        throw new TranspileError(
          `Only imports from "${PACKAGE}" are available in the playground, but found "${specifier.text}".`,
        );
      }
      specifiers.push(specifier);
    }
    typescript.forEachChild(node, visit);
  };
  typescript.forEachChild(file, visit);

  let rewritten = code;
  // From the last specifier up, so earlier offsets stay valid
  for (const specifier of specifiers.toSorted((a, b) => b.getStart(file) - a.getStart(file))) {
    rewritten =
      rewritten.slice(0, specifier.getStart(file)) +
      JSON.stringify(shimUrl) +
      rewritten.slice(specifier.end);
  }
  return rewritten;
}

/**
 * The module specifier of an import, re-export, or dynamic import
 */
function moduleSpecifier(typescript: typeof ts, node: ts.Node): ts.StringLiteralLike | undefined {
  if (typescript.isImportDeclaration(node) || typescript.isExportDeclaration(node)) {
    return node.moduleSpecifier;
  }
  if (
    typescript.isCallExpression(node) &&
    node.expression.kind === typescript.SyntaxKind.ImportKeyword
  ) {
    const [argument] = node.arguments;
    if (!argument || !typescript.isStringLiteralLike(argument)) {
      throw new TranspileError(
        `Only imports from "${PACKAGE}" with a literal module name are available in the playground.`,
      );
    }
    return argument;
  }
  return undefined;
}
