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
 * - Each statement in a block, `case` clause or the top level is preceded by
 *   `__playground.r(loc)`, recording that it started. An expression-bodied
 *   arrow function gets the same as a comma expression.
 */

/** The `fn` of top-level statements */
export const TOP_LEVEL = -1;

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
  /**
   * Instrumented statements, with the location of their enclosing function,
   * or {@link TOP_LEVEL}
   */
  statements: { loc: number; fn: number }[];
  /**
   * Call sites that look like method calls, such as `client.api.Email.get(…)`,
   * with the method they make
   */
  methodCallSites: { loc: number; method: string }[];
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
  /** Locations of the statements that started */
  reached: number[];
}

// A callee such as `client.api.Email.get` or `api.Mailbox.query`
const methodCallee = /(?:^|\.)api\.([A-Z]\w*)\.(\w+)$/;

/**
 * Create the transformer, and the {@link SourceInfo} it fills in as it runs
 */
export function instrument(): {
  transformer: ts.TransformerFactory<ts.SourceFile>;
  info: SourceInfo;
} {
  const info: SourceInfo = { ranges: [], statements: [], methodCallSites: [] };

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => (file) => {
    const { factory } = context;
    const tracer = (method: string, args: ts.Expression[]) =>
      factory.createCallExpression(
        factory.createPropertyAccessExpression(factory.createIdentifier(TRACER), method),
        undefined,
        args,
      );
    const locate = (node: ts.Node): number => {
      const position = (offset: number) => {
        const { line, character } = file.getLineAndCharacterOfPosition(offset);
        return { line: line + 1, column: character + 1 };
      };
      info.ranges.push({ start: position(node.getStart(file)), end: position(node.getEnd()) });
      return info.ranges.length - 1;
    };
    const literal = (loc: number) => factory.createNumericLiteral(loc);
    // The location of the function being visited, or TOP_LEVEL
    let fn = TOP_LEVEL;

    // `__playground.r(loc)`, recording that the statement started
    const marker = (statement: ts.Statement): ts.Statement => {
      const loc = locate(statement);
      info.statements.push({ loc, fn });
      return factory.createExpressionStatement(tracer("r", [literal(loc)]));
    };
    const statements = (list: ts.NodeArray<ts.Statement>): ts.Statement[] =>
      list.flatMap((statement) => {
        const visited = ts.visitNode(statement, visit, ts.isStatement);
        // Declarations that do not run as statements stay as they are
        if (
          ts.isFunctionDeclaration(statement) ||
          ts.isImportDeclaration(statement) ||
          ts.isExportDeclaration(statement) ||
          ts.isInterfaceDeclaration(statement) ||
          ts.isTypeAliasDeclaration(statement) ||
          ts.isEmptyStatement(statement)
        ) {
          return [visited];
        }
        return [marker(statement), visited];
      });

    function visit(node: ts.Node): ts.Node {
      if (ts.isFunctionLike(node) && "body" in node && node.body) {
        const outer = fn;
        fn = locate(node);
        try {
          return visitFunction(node);
        } finally {
          fn = outer;
        }
      }
      if (ts.isBlock(node)) {
        return factory.updateBlock(node, statements(node.statements));
      }
      if (ts.isCaseClause(node)) {
        return factory.updateCaseClause(
          node,
          ts.visitNode(node.expression, visit, ts.isExpression),
          statements(node.statements),
        );
      }
      if (ts.isDefaultClause(node)) {
        return factory.updateDefaultClause(node, statements(node.statements));
      }
      if (ts.isAwaitExpression(node)) {
        const loc = locate(node);
        const expression = ts.visitNode(node.expression, visit, ts.isExpression);
        return factory.updateAwaitExpression(node, tracer("a", [literal(loc), expression]));
      }
      if (ts.isCallExpression(node) && isInstrumentableCall(node)) {
        const loc = locate(node);
        const callee = node.expression.getText(file).replaceAll(/\s+/g, "");
        const method = methodCallee.exec(callee);
        if (method) info.methodCallSites.push({ loc, method: `${method[1]}/${method[2]}` });
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

    function visitFunction(node: ts.SignatureDeclaration & { body?: ts.Node }): ts.Node {
      if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) {
        // `() => expr` becomes `() => (r(loc), expr)`
        const loc = locate(node.body);
        info.statements.push({ loc, fn });
        const body = ts.visitNode(node.body, visit, ts.isExpression);
        return factory.updateArrowFunction(
          node,
          node.modifiers,
          node.typeParameters,
          node.parameters,
          node.type,
          node.equalsGreaterThanToken,
          factory.createParenthesizedExpression(
            factory.createCommaListExpression([tracer("r", [literal(loc)]), body]),
          ),
        );
      }
      return ts.visitEachChild(node, visit, context);
    }

    return factory.updateSourceFile(file, statements(file.statements));
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
  const trace: Trace = { calls: {}, pending: {}, awaited: {}, reached: [] };
  const reached = new Set<number>();
  let current: number | undefined;
  return {
    trace: (): Trace => ({ ...trace, reached: [...reached] }),
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
      r(loc: number): void {
        reached.add(loc);
      },
    },
  };
}
