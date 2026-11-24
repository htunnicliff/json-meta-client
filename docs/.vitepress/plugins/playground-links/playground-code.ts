import ts from "typescript";

import { docsClientOptions } from "../../../../scripts/docs-client-options.ts";

/**
 * A TypeScript fence of a docs page, in reading order
 */
export interface Example {
  source: string;
}

const LIBRARY = "json-meta-client";

/**
 * An import of one binding, as `{ name: "JsonMetaClient", module: "json-meta-client" }`
 */
interface ImportedName {
  module: string;
  /** The specifier as written, as `type Config` or `isMethodError as failed` */
  specifier: string;
}

/**
 * What one example imports, declares and uses at the top level
 */
interface Parsed {
  /** The source without its import declarations */
  body: string;
  /** Names bound by named imports, by local name */
  named: Map<string, ImportedName>;
  /** Import declarations that are not plain named imports, as written */
  otherImports: string[];
  /** Names bound at the top level, imports included */
  declared: Set<string>;
  /** Names the example refers to */
  used: Set<string>;
}

function parse(source: string): Parsed {
  const file = ts.createSourceFile("example.ts", source, ts.ScriptTarget.ESNext, true);
  const named = new Map<string, ImportedName>();
  const otherImports: string[] = [];
  const declared = new Set<string>();
  const collect = (name: ts.BindingName) => {
    if (ts.isIdentifier(name)) declared.add(name.text);
    else name.elements.forEach((element) => ts.isBindingElement(element) && collect(element.name));
  };
  const imports = file.statements.filter(ts.isImportDeclaration);
  for (const node of imports) {
    const module = ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : "";
    const clause = node.importClause;
    const bindings = clause?.namedBindings;
    if (clause && !clause.name && !clause.isTypeOnly && bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        named.set(element.name.text, { module, specifier: element.getText(file) });
        declared.add(element.name.text);
      }
    } else {
      otherImports.push(node.getText(file));
      if (clause?.name) declared.add(clause.name.text);
      if (bindings && ts.isNamespaceImport(bindings)) declared.add(bindings.name.text);
      if (bindings && ts.isNamedImports(bindings)) {
        bindings.elements.forEach(({ name }) => declared.add(name.text));
      }
    }
  }
  for (const statement of file.statements) {
    if (ts.isVariableStatement(statement)) {
      statement.declarationList.declarations.forEach(({ name }) => collect(name));
    } else if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name
    ) {
      declared.add(statement.name.text);
    }
  }
  const used = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && isReference(node)) used.add(node.text);
    ts.forEachChild(node, visit);
  };
  file.statements.filter((statement) => !ts.isImportDeclaration(statement)).forEach(visit);
  const body = removeRanges(
    source,
    imports.map((node) => [node.getStart(file), node.getEnd()]),
  ).trim();
  return { body, named, otherImports, declared, used };
}

/**
 * Whether an identifier refers to a binding, rather than naming a property or
 * declaring one
 */
function isReference(node: ts.Identifier): boolean {
  const { parent } = node;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if (ts.isQualifiedName(parent) && parent.right === node) return false;
  if (ts.isBindingElement(parent) && parent.propertyName === node) return false;
  const declares =
    ts.isPropertyAssignment(parent) ||
    ts.isPropertySignature(parent) ||
    ts.isPropertyDeclaration(parent) ||
    ts.isMethodDeclaration(parent) ||
    ts.isMethodSignature(parent) ||
    ts.isBindingElement(parent) ||
    ts.isVariableDeclaration(parent) ||
    ts.isFunctionDeclaration(parent) ||
    ts.isParameter(parent);
  return !(declares && parent.name === node);
}

function removeRanges(source: string, ranges: [number, number][]): string {
  let result = source;
  for (const [start, end] of ranges.toSorted(([a], [b]) => b - a)) {
    result = result.slice(0, start) + result.slice(end).replace(/^\n/, "");
  }
  return result;
}

/**
 * The client that docs examples use without constructing one, as
 * `scripts/docs-client.ts` declares it
 */
function docsClientSource(): string {
  const options = Object.entries(docsClientOptions).map(([key, value]) => {
    const text = Array.isArray(value)
      ? `[${value.map((item: unknown) => JSON.stringify(item)).join(", ")}]`
      : JSON.stringify(value);
    return `  ${key}: ${text},`;
  });
  return `const client = new JsonMetaClient({\n${options.join("\n")}\n});`;
}

const withoutType = (specifier: string) => specifier.replace(/^type\s+/, "");

/**
 * Named imports, one declaration per module, the library's first
 */
function importDeclarations(names: readonly ImportedName[]): string[] {
  const byModule = Map.groupBy(names, ({ module }) => module);
  const modules = [...byModule.keys()].toSorted((a, b) =>
    a === LIBRARY ? -1 : b === LIBRARY ? 1 : a.localeCompare(b),
  );
  return modules.map((module) => {
    const specifiers = [...new Set(byModule.get(module)!.map(({ specifier }) => specifier))];
    const sorted = specifiers.toSorted((a, b) => withoutType(a).localeCompare(withoutType(b)));
    return `import { ${sorted.join(", ")} } from ${JSON.stringify(module)};`;
  });
}

/**
 * Whether an example shows something to run in the playground: it uses a
 * client, rather than only constructing one
 */
export function hasPlaygroundCode(source: string): boolean {
  return parse(source).used.has("client");
}

/**
 * The code that opens the example at `index` in the playground, as a module
 * that runs on its own. An example that uses the docs' ambient `client` gets
 * that client constructed first. Names that earlier examples on the page
 * import are imported; values they declare stand for themselves, as in
 * `"<inboxId>"`, so the playground shows the example's own requests rather
 * than stopping at the earlier examples' awaits.
 */
export function playgroundCode(examples: readonly Example[], index: number): string {
  const parsed = examples.map(({ source }) => parse(source));
  const target = parsed[index];
  if (!target) throw new RangeError(`No example at ${index}`);
  const earlier = parsed.slice(0, index);
  const needsClient = target.used.has("client") && !target.declared.has("client");

  const named = [...target.named.values()];
  if (needsClient) named.push({ module: LIBRARY, specifier: "JsonMetaClient" });
  const placeholders: string[] = [];
  for (const name of target.used) {
    if (name === "client" || target.declared.has(name)) continue;
    const from = earlier.findLast(({ declared }) => declared.has(name));
    if (!from) continue;
    const imported = from.named.get(name);
    if (imported) named.push(imported);
    else placeholders.push(`const ${name}: any = "<${name}>";`);
  }

  const sections = [
    [...importDeclarations(named), ...target.otherImports].join("\n"),
    needsClient ? docsClientSource() : "",
    placeholders.length
      ? `// Values that earlier examples on the page found\n${placeholders.join("\n")}`
      : "",
    target.body,
  ].filter(Boolean);
  return `${sections.join("\n\n")}\n`;
}
