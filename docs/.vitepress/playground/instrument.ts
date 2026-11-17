import ts from "typescript";

import { TRACER } from "./tracer.ts";

/**
 * A transform that lets the run report where things happened in the user's
 * code, as settled by the #201 prototype:
 *
 * - Each call `f(a, b)` becomes `f(...__playground.m(loc, [a, b]))`. `m` marks
 *   `loc` as the current call site once the arguments are evaluated, so calls
 *   inside the arguments cannot overwrite it, and `await` in the arguments
 *   stays legal. A call id drawn during the call maps to `loc`.
 * - Each `await e` becomes `await __playground.a(loc, e)`, which counts the
 *   awaits pending at `loc`.
 */

export interface SourcePosition {
  /** 1-based */
  line: number;
  /** 1-based */
  column: number;
}

export interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}

export interface SourceInfo {
  /** Every instrumented location, by its index */
  ranges: SourceRange[];
}

/**
 * Create the transformer, and the {@link SourceInfo} it fills in as it runs
 */
export function instrument(): {
  transformer: ts.TransformerFactory<ts.SourceFile>;
  info: SourceInfo;
} {
  const info: SourceInfo = { ranges: [] };

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => (file) => {
    const { factory } = context;
    const tracer = (method: string, args: ts.Expression[]) =>
      factory.createCallExpression(
        factory.createPropertyAccessExpression(factory.createIdentifier(TRACER), method),
        undefined,
        args,
      );

    const literal = (loc: number) => factory.createNumericLiteral(loc);
    const rangeOf = (node: ts.Node): SourceRange => {
      const position = (offset: number) => {
        const { line, character } = file.getLineAndCharacterOfPosition(offset);
        return { line: line + 1, column: character + 1 };
      };
      return { start: position(node.getStart(file)), end: position(node.getEnd()) };
    };
    const locate = (node: ts.Node): number => info.ranges.push(rangeOf(node)) - 1;

    function visit(node: ts.Node): ts.Node {
      if (ts.isAwaitExpression(node)) {
        const loc = locate(node);
        const expression = ts.visitNode(node.expression, visit, ts.isExpression);
        return factory.updateAwaitExpression(node, tracer("a", [literal(loc), expression]));
      }
      if (ts.isCallExpression(node) && isInstrumentableCall(node)) {
        const loc = locate(node);
        const updated = ts.visitEachChild(node, visit, context);
        const args = [
          factory.createSpreadElement(
            tracer("m", [literal(loc), factory.createArrayLiteralExpression(updated.arguments)]),
          ),
        ];
        return ts.isCallChain(updated)
          ? factory.updateCallChain(
              updated,
              updated.expression,
              updated.questionDotToken,
              updated.typeArguments,
              args,
            )
          : factory.updateCallExpression(updated, updated.expression, updated.typeArguments, args);
      }
      return ts.visitEachChild(node, visit, context);
    }

    return ts.visitEachChild(file, visit, context);
  };

  return { transformer, info };
}

function isInstrumentableCall(node: ts.CallExpression): boolean {
  const { kind } = node.expression;
  return kind !== ts.SyntaxKind.SuperKeyword && kind !== ts.SyntaxKind.ImportKeyword;
}
