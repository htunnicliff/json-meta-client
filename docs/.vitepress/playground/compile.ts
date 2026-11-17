import ts from "typescript";

import { SHIM_SPECIFIER } from "./protocol.ts";
import type { Diagnostic } from "./protocol.ts";

const LIBRARY = "json-meta-client";

/**
 * The name the playground's editor and diagnostics give the user's code
 */
export const FILE_NAME = "playground.ts";

export type CompileOutput = { code: string } | { diagnostics: Diagnostic[] };

/**
 * Transpile the user's TypeScript to a JavaScript module. Imports of
 * `json-meta-client` are pointed at {@link SHIM_SPECIFIER}; any other import
 * is reported as a diagnostic, since only the library is available. Type
 * errors are not reported: the editor shows those, and they do not stop a run.
 */
export function compile(source: string): CompileOutput {
  const diagnostics: Diagnostic[] = [];
  const { outputText, diagnostics: syntax = [] } = ts.transpileModule(source, {
    fileName: FILE_NAME,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleDetection: ts.ModuleDetectionKind.Force,
      verbatimModuleSyntax: false,
    },
    // After TypeScript's own transforms, so type-only imports are gone
    transformers: { after: [rewriteImports(diagnostics)] },
  });
  diagnostics.unshift(...syntax.map(toDiagnostic));
  if (diagnostics.length) return { diagnostics };
  return { code: `${outputText}\n//# sourceURL=${FILE_NAME}\n` };
}

function toDiagnostic(diagnostic: ts.Diagnostic): Diagnostic {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  if (!diagnostic.file || diagnostic.start === undefined) return { message };
  return { message, ...position(diagnostic.file, diagnostic.start) };
}

function position(file: ts.SourceFile, offset: number): { line: number; column: number } {
  const { line, character } = file.getLineAndCharacterOfPosition(offset);
  return { line: line + 1, column: character + 1 };
}

/**
 * Point each import of the library at the shim, and report every other
 * module specifier
 */
function rewriteImports(diagnostics: Diagnostic[]): ts.TransformerFactory<ts.SourceFile> {
  return (context) => (file) => {
    const { factory } = context;
    // Nodes made by earlier transforms have no position, so fall back to the
    // original node's
    const report = (specifier: ts.Expression) => {
      const original = ts.getOriginalNode(specifier);
      const name = ts.isStringLiteralLike(specifier) ? specifier.text : undefined;
      const message =
        name === undefined
          ? `The playground can only import "${LIBRARY}", by name`
          : `The playground can only import "${LIBRARY}", not "${name}"`;
      const start = original.pos >= 0 ? original.getStart(file) : undefined;
      diagnostics.push(start === undefined ? { message } : { message, ...position(file, start) });
    };
    const target = (specifier: ts.Expression): ts.StringLiteral | undefined => {
      if (ts.isStringLiteralLike(specifier) && specifier.text === LIBRARY) {
        return factory.createStringLiteral(SHIM_SPECIFIER);
      }
      report(specifier);
      return undefined;
    };
    const visit = (node: ts.Node): ts.Node => {
      if (ts.isImportDeclaration(node)) {
        const specifier = target(node.moduleSpecifier);
        return specifier
          ? factory.updateImportDeclaration(
              node,
              node.modifiers,
              node.importClause,
              specifier,
              node.attributes,
            )
          : node;
      }
      if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
        const specifier = target(node.moduleSpecifier);
        return specifier
          ? factory.updateExportDeclaration(
              node,
              node.modifiers,
              node.isTypeOnly,
              node.exportClause,
              specifier,
              node.attributes,
            )
          : node;
      }
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const [first, ...rest] = node.arguments;
        const specifier = first && target(first);
        const updated = ts.visitEachChild(node, visit, context);
        return specifier
          ? factory.updateCallExpression(updated, updated.expression, updated.typeArguments, [
              specifier,
              ...rest,
            ])
          : updated;
      }
      return ts.visitEachChild(node, visit, context);
    };
    return ts.visitEachChild(file, visit, context);
  };
}
