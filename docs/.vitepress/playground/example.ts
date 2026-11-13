/**
 * The body of the first TypeScript fence in a Markdown page
 */
export function firstTypeScriptFence(markdown: string): string {
  const fence = /^```(?:ts|typescript)(?:[ \t][^\n]*)?\n([\s\S]*?)^```/m.exec(markdown);
  if (fence?.[1] === undefined) throw new Error("No TypeScript fence found");
  return fence[1];
}
