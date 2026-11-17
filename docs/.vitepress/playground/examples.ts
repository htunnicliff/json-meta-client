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

export interface Example {
  id: string;
  title: string;
  code: string;
}

const sequentialAwaits = `import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: "********",
  capabilities: ["mail"],
});

const unread = await client.api.Email.query({
  filter: { notKeyword: "$seen" },
  limit: 5,
});

const emails = await client.api.Email.get({
  ids: unread.ids,
  properties: ["subject", "from"],
});

for (const { subject, from } of emails.list) {
  console.log(subject, from);
}
`;

/**
 * The examples the playground offers, the first being its default
 */
export const examples: readonly Example[] = [
  { id: "unread-subjects", title: "Unread subjects", code: defaultExample },
  { id: "sequential-awaits", title: "Sequential awaits", code: sequentialAwaits },
];

const withoutWhitespace = (text: string) => text.replaceAll(/\s+/g, "");

/**
 * The built-in example whose code this is, if any, ignoring whitespace
 */
export function findExample(code: string): Example | undefined {
  const normalized = withoutWhitespace(code);
  return examples.find((example) => withoutWhitespace(example.code) === normalized);
}
