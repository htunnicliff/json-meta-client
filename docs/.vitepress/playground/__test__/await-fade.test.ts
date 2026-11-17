import { javascript } from "@codemirror/lang-javascript";
import { ensureSyntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import { firstAwaitEnd } from "../await-fade.ts";

function endOf(code: string) {
  const state = EditorState.create({ doc: code, extensions: javascript({ typescript: true }) });
  ensureSyntaxTree(state, state.doc.length);
  const end = firstAwaitEnd(state);
  return end === undefined ? undefined : code.slice(0, end);
}

describe(firstAwaitEnd, () => {
  it("ends at the statement holding the first await", () => {
    const code = "const a = 1;\nconst b = await f({\n  x: 1,\n});\nconsole.log(b);\nawait g();";
    expect(endOf(code)).toBe("const a = 1;\nconst b = await f({\n  x: 1,\n});");
  });

  it("covers the whole top-level statement around a nested await", () => {
    const code = "if (x) {\n  await f();\n}\nlog();";
    expect(endOf(code)).toBe("if (x) {\n  await f();\n}");
  });

  it("finds for await", () => {
    expect(endOf("for await (const x of xs) log(x);\nlog();")).toBe(
      "for await (const x of xs) log(x);",
    );
  });

  it("skips awaits in functions, which run only when called", () => {
    const code = "async function f() {\n  await g();\n}\nconst h = async () => await g();\nf();";
    expect(endOf(code)).toBeUndefined();
  });
});
