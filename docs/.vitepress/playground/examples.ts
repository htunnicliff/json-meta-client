import homeRequest from "../../snippets/home-request.md?raw";

/**
 * The first TypeScript fence of a Markdown page
 */
export function firstTypeScriptFence(markdown: string): string {
  const match = /^```(?:ts|typescript)\b[^\n]*\n([\s\S]*?)^```/m.exec(markdown);
  if (!match?.[1]) throw new Error("No TypeScript fence found");
  return match[1];
}

/**
 * The home page example, read from its snippet so the two cannot drift apart
 */
export const defaultExample: string = firstTypeScriptFence(homeRequest);
