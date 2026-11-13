// PROTOTYPE (#201): throwaway. Answers: can the playground worker link method
// calls and pending awaits to source lines using a transpile-time transform?
import ts from "typescript";

export interface Range {
  from: number;
  to: number;
  /** 1-based line/column of the start and end */
  start: { line: number; col: number };
  end: { line: number; col: number };
}

export interface Stmt {
  loc: number;
  /** Loc of the enclosing function-like node, or -1 for top level */
  fn: number;
}

export interface Instrumented {
  code: string;
  /** Source ranges by loc id (index) */
  ranges: Range[];
  statements: Stmt[];
}

const PG = "__pg";

export function instrument(source: string): Instrumented {
  const ranges: Range[] = [];
  const statements: Stmt[] = [];

  const transformer: ts.TransformerFactory<ts.SourceFile> = (ctx) => {
    const f = ctx.factory;
    let sf!: ts.SourceFile;
    const fnStack: number[] = [-1];

    const addLoc = (node: ts.Node): number => {
      const from = node.getStart(sf);
      const to = node.end;
      const s = sf.getLineAndCharacterOfPosition(from);
      const e = sf.getLineAndCharacterOfPosition(to);
      ranges.push({
        from,
        to,
        start: { line: s.line + 1, col: s.character + 1 },
        end: { line: e.line + 1, col: e.character + 1 },
      });
      return ranges.length - 1;
    };

    const pg = (name: string, ...args: ts.Expression[]) =>
      f.createCallExpression(
        f.createPropertyAccessExpression(f.createIdentifier(PG), name),
        undefined,
        args,
      );
    const num = (n: number) => f.createNumericLiteral(n);

    const isFn = (n: ts.Node) =>
      ts.isFunctionDeclaration(n) ||
      ts.isFunctionExpression(n) ||
      ts.isArrowFunction(n) ||
      ts.isMethodDeclaration(n) ||
      ts.isConstructorDeclaration(n) ||
      ts.isGetAccessorDeclaration(n) ||
      ts.isSetAccessorDeclaration(n);

    const skipStatement = (s: ts.Statement) =>
      ts.isFunctionDeclaration(s) ||
      ts.isImportDeclaration(s) ||
      ts.isInterfaceDeclaration(s) ||
      ts.isTypeAliasDeclaration(s) ||
      ts.isEmptyStatement(s);

    const visitStatements = (stmts: readonly ts.Statement[]): ts.Statement[] =>
      stmts.flatMap((s) => {
        const visited = visit(s) as ts.Statement;
        if (skipStatement(s)) return [visited];
        const loc = addLoc(s);
        statements.push({ loc, fn: fnStack.at(-1)! });
        return [f.createExpressionStatement(pg("r", num(loc))), visited];
      });

    const visit = (node: ts.Node): ts.Node => {
      if (isFn(node)) {
        fnStack.push(addLoc(node));
        try {
          if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) {
            // Expression body: record "reached" with a comma expression.
            const loc = addLoc(node.body);
            statements.push({ loc, fn: fnStack.at(-1)! });
            const body = visit(node.body) as ts.Expression;
            return f.updateArrowFunction(
              node,
              node.modifiers,
              node.typeParameters,
              node.parameters.map((p) => visit(p) as ts.ParameterDeclaration),
              node.type,
              node.equalsGreaterThanToken,
              f.createParenthesizedExpression(
                f.createComma(pg("r", num(loc)), f.createParenthesizedExpression(body)),
              ),
            );
          }
          return ts.visitEachChild(node, visit, ctx);
        } finally {
          fnStack.pop();
        }
      }
      if (ts.isBlock(node)) {
        return f.updateBlock(node, visitStatements(node.statements));
      }
      if (ts.isCaseClause(node) || ts.isDefaultClause(node)) {
        const stmts = visitStatements(node.statements);
        return ts.isCaseClause(node)
          ? f.updateCaseClause(node, visit(node.expression) as ts.Expression, stmts)
          : f.updateDefaultClause(node, stmts);
      }
      if (
        ts.isCallExpression(node) &&
        node.expression.kind !== ts.SyntaxKind.SuperKeyword &&
        node.expression.kind !== ts.SyntaxKind.ImportKeyword
      ) {
        // f(a, b) -> f(...__pg.m(loc, [a, b])). The marker is set after the
        // arguments are evaluated, immediately before the call, so calls inside
        // the arguments (or an `await` there) cannot overwrite it.
        const loc = addLoc(node);
        const callee = visit(node.expression) as ts.Expression;
        const args = node.arguments.map((a) => visit(a) as ts.Expression);
        return f.updateCallExpression(node, callee, node.typeArguments, [
          f.createSpreadElement(pg("m", num(loc), f.createArrayLiteralExpression(args))),
        ]);
      }
      if (ts.isAwaitExpression(node)) {
        const loc = addLoc(node);
        const inner = visit(node.expression) as ts.Expression;
        return f.updateAwaitExpression(node, pg("a", num(loc), inner));
      }
      return ts.visitEachChild(node, visit, ctx);
    };

    return (file) => {
      sf = file;
      return f.updateSourceFile(file, visitStatements(file.statements));
    };
  };

  const out = ts.transpileModule(source, {
    fileName: "example.ts",
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
    transformers: { before: [transformer] },
  });
  return { code: out.outputText, ranges, statements };
}

/** Same transpile without the transformer, to measure its cost. */
export function plainTranspile(source: string): string {
  return ts.transpileModule(source, {
    fileName: "example.ts",
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
}
