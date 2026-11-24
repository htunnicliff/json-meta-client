import { describe, expect, it } from "vitest";

import { readCodeLink } from "../../../playground/code-link.ts";
import { playgroundHref } from "../index.ts";
import { hasPlaygroundCode, playgroundCode } from "../playground-code.ts";

const docsClient = `const client = new JsonMetaClient({
  auth: "<credentials>",
  sessionUrl: "<server>/.well-known/jmap",
  capabilities: ["mail", "submission"],
});`;

const examples = (...sources: string[]) => sources.map((source) => ({ source }));

describe(hasPlaygroundCode, () => {
  it("is true for code that uses a client", () => {
    expect(hasPlaygroundCode(`await client.api.Mailbox.get({});`)).toBe(true);
  });

  it("is false for code that only constructs a client", () => {
    expect(
      hasPlaygroundCode(`import { JsonMetaClient } from "json-meta-client";
const client = new JsonMetaClient({ sessionUrl: "<url>", auth: "<token>", capabilities: ["mail"] });`),
    ).toBe(false);
  });
});

describe(playgroundCode, () => {
  it("constructs the docs client for code that uses it", () => {
    expect(playgroundCode(examples(`await client.api.Mailbox.get({});`), 0)).toBe(
      `import { JsonMetaClient } from "json-meta-client";\n\n${docsClient}\n\nawait client.api.Mailbox.get({});\n`,
    );
  });

  it("keeps a client the code constructs itself", () => {
    const source = `import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({ sessionUrl: "<server>", auth: "<credentials>", capabilities: ["mail"] });

await client.api.Mailbox.get({});`;
    expect(playgroundCode(examples(source), 0)).toBe(`${source}\n`);
  });

  it("stands values from earlier examples in for themselves", () => {
    const page = examples(
      `const session = await client.session;`,
      `const mailboxes = await client.api.Mailbox.query({});\nconst inboxId = mailboxes.ids[0]!;`,
      `await client.api.Email.query({ filter: { inMailbox: inboxId } });`,
    );
    expect(playgroundCode(page, 2)).toBe(
      `import { JsonMetaClient } from "json-meta-client";\n\n${docsClient}\n\n// Values that earlier examples on the page found\nconst inboxId: any = "<inboxId>";\n\nawait client.api.Email.query({ filter: { inMailbox: inboxId } });\n`,
    );
  });

  it("does not take the client from an earlier example", () => {
    const page = examples(
      `import { JsonMetaClient } from "json-meta-client";\nconst client = new JsonMetaClient({ sessionUrl: "<url>", auth: "<token>", capabilities: ["mail"] });`,
      `await client.api.Mailbox.get({});`,
    );
    expect(playgroundCode(page, 1)).not.toContain("<url>");
  });

  it("ignores property names that match earlier declarations", () => {
    const page = examples(`const id = "x";`, `console.log(client.id, { id: 1 });`);
    expect(playgroundCode(page, 1)).not.toContain(`const id`);
  });

  it("imports what earlier examples imported", () => {
    const page = examples(
      `import { isMethodError, type Config } from "json-meta-client";`,
      `import { JsonMetaClient } from "json-meta-client";\nconsole.log(isMethodError, client);`,
    );
    expect(playgroundCode(page, 1)).toMatch(
      /^import \{ isMethodError, JsonMetaClient \} from "json-meta-client";\n\nconst client/,
    );
  });
});

describe(playgroundHref, () => {
  it("links to code the playground reads back", async () => {
    const code = `await client.api.Email.query({ filter: { text: "invoice ✓" } });\n`;
    const href = playgroundHref(code);
    expect(href).toMatch(/^\/playground#code=[\w-]+$/);
    expect(await readCodeLink(new URL(href, "https://example.com").hash)).toBe(code);
  });

  it("reads no code from other fragments", async () => {
    expect(await readCodeLink("")).toBeUndefined();
    expect(await readCodeLink("#code=not-deflate")).toBeUndefined();
  });
});
