import ts from "typescript";

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

/** The global the instrumented code reports to */
export const TRACER = "__playground";

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
 * What a run reports about the instrumented code
 */
export interface Trace {
  /**
   * The random suffix of each JMAP call id, as in `f3c9ebfd` for
   * `Email/query::f3c9ebfd` → the location of the call that made it
   */
  calls: Record<string, number>;
  /** Await location → how many awaits there are pending now */
  pending: Record<number, number>;
  /** Await location → the call ids of the method calls it is waiting on, when known */
  awaited: Record<number, string[]>;
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

/**
 * The runtime that instrumented code reports to, and the {@link Trace} it
 * keeps
 */
export function createTracer() {
  const trace: Trace = { calls: {}, pending: {}, awaited: {} };
  let current: number | undefined;
  return {
    trace: (): Trace => ({ ...trace }),
    /** Record the call site of a call id suffix the library just drew */
    onCallId: (suffix: string) => {
      if (current !== undefined) trace.calls[suffix] = current;
    },
    runtime: {
      m(loc: number, args: unknown[]): unknown[] {
        current = loc;
        return args;
      },
      a(loc: number, value: unknown): Promise<unknown> {
        trace.pending[loc] = (trace.pending[loc] ?? 0) + 1;
        const id: unknown =
          value && typeof value === "object" ? Reflect.get(value, "$id") : undefined;
        if (typeof id === "string") (trace.awaited[loc] ??= []).push(id);
        const done = () => {
          trace.pending[loc] = (trace.pending[loc] ?? 1) - 1;
          if (typeof id === "string") {
            trace.awaited[loc] = (trace.awaited[loc] ?? []).filter((awaited) => awaited !== id);
          }
        };
        return Promise.resolve(value).finally(done);
      },
    },
  };
}
