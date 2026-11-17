import ts from "typescript";
import { describe, expect, it } from "vitest";

import { editorCompilerOptions } from "../editor-options.ts";
import { defaultExample, examples } from "../examples.ts";
import { collectTypes } from "../types-plugin.ts";

const files = collectTypes();
const root = "/virtual/";
const user = `${root}playground.ts`;

/**
 * A language service over the editor's files, as the editor sees them
 */
function languageService(source: string): ts.LanguageService {
  const virtual = new Map<string, string>(
    Object.entries(files).map(([file, text]) => [root + file, text]),
  );
  virtual.set(user, source);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const compilerOptions = { ...editorCompilerOptions } as unknown as ts.CompilerOptions;
  const read = (file: string) => virtual.get(file) ?? ts.sys.readFile(file);
  return ts.createLanguageService({
    getCompilationSettings: () => compilerOptions,
    getScriptFileNames: () => [user, `${root}docs-client.ts`],
    getScriptVersion: () => "1",
    getScriptSnapshot: (file) => {
      const text = read(file);
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => root,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: (file) => virtual.has(file) || ts.sys.fileExists(file),
    readFile: read,
    directoryExists: (directory) =>
      [...virtual.keys()].some((file) => file.startsWith(`${directory}/`)) ||
      ts.sys.directoryExists(directory),
  });
}

const errors = (service: ts.LanguageService) =>
  [...service.getSyntacticDiagnostics(user), ...service.getSemanticDiagnostics(user)].map(
    ({ messageText }) => ts.flattenDiagnosticMessageText(messageText, "\n"),
  );

describe(collectTypes, () => {
  it("type-checks the home page example without errors", () => {
    expect(errors(languageService(defaultExample))).toEqual([]);
  });

  it.each(examples)("type-checks the $title example without errors", ({ code }) => {
    expect(errors(languageService(code))).toEqual([]);
  });

  it("narrows a result by `properties`", () => {
    const service = languageService(defaultExample);
    const position = defaultExample.indexOf("emails.list") + 1;

    const info = service.getQuickInfoAtPosition(user, position);
    const type = ts.displayPartsToString(info?.displayParts);

    expect(type).toContain("subject");
    expect(type).toContain("from");
    expect(type).not.toContain("receivedAt");
  });

  it("declares the docs' ambient `client`", () => {
    expect(errors(languageService("const { list } = await client.api.Mailbox.get({});"))).toEqual(
      [],
    );
  });

  it("reports type errors", () => {
    expect(errors(languageService("await client.api.Email.get({ ids: 5 });"))).toEqual([
      expect.stringContaining("Type 'number' is not assignable"),
    ]);
  });

  it("includes only the type-fest files the library uses", () => {
    const typeFest = Object.keys(files).filter((file) => file.includes("/type-fest/"));
    expect(typeFest.length).toBeLessThan(100);
  });
});
