import { readFile } from "node:fs/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

import { firstTypeScriptFence } from "./example.ts";
import type { RunnerMessage } from "./messages.ts";
import { startRun } from "./run.ts";
import type { RunHandle } from "./run.ts";

/**
 * Run code as a module, using a data URL since Node cannot import Blob URLs.
 * Each call gets a unique URL, since imports are cached by URL.
 */
let nextModule = 0;
const dataModuleUrl = (source: string) =>
  `data:text/javascript,${encodeURIComponent(source)}\n// ${nextModule++}`;

interface Running {
  messages: RunnerMessage[];
  handle: RunHandle;
}

function run(code: string): Running {
  const messages: RunnerMessage[] = [];
  const handle = startRun({
    code,
    moduleUrl: dataModuleUrl,
    post: (message) => messages.push(message),
  });
  return { messages, handle };
}

const requests = (messages: readonly RunnerMessage[]) =>
  messages.flatMap((message) => (message.type === "request" ? [message.request] : []));

const errorMessages = (messages: readonly RunnerMessage[]) =>
  messages.flatMap((message) => (message.type === "error" ? [message.message] : []));

async function runUntil(
  code: string,
  done: (messages: readonly RunnerMessage[]) => boolean,
): Promise<Running> {
  const running = run(code);
  try {
    await vi.waitFor(() => expect(done(running.messages)).toBe(true), { timeout: 2_000 });
    return running;
  } catch (error) {
    running.handle.stop();
    throw new Error(`${String(error)}\nmessages: ${JSON.stringify(running.messages, null, 2)}`, {
      cause: error,
    });
  }
}

async function example(page: string): Promise<string> {
  const markdown = await readFile(new URL(page, import.meta.url), "utf8");
  return firstTypeScriptFence(markdown);
}

const running: Running[] = [];

afterEach(() => {
  for (const { handle } of running.splice(0)) handle.stop();
});

function track(result: Running): Running {
  running.push(result);
  return result;
}

describe(startRun, () => {
  it("posts the home example's Session fetch and JMAP Request", async () => {
    const markdown = await readFile(
      new URL("../../snippets/home-request.md", import.meta.url),
      "utf8",
    );
    const source = firstTypeScriptFence(markdown);
    const expected = JSON.parse(
      /```json[^\n]*\n([\s\S]*?)^```/m.exec(markdown)?.[1] ?? "null",
    ) as unknown;

    const result = track(
      await runUntil(source, (messages) => messages.some((message) => message.type === "waiting")),
    );

    expect(requests(result.messages).map(({ kind, method }) => ({ kind, method }))).toEqual([
      { kind: "session", method: "GET" },
      { kind: "request", method: "POST" },
    ]);
    expect(requests(result.messages).at(-1)?.body).toEqual(expected);
    expect(result.messages.at(-1)).toEqual({ type: "waiting" });
  });

  it("stops at the first await, leaving later batches unsent", async () => {
    const result = track(
      await runUntil(
        `
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: "<token>",
  capabilities: ["mail"],
});

const unread = await client.api.Email.query({ limit: 5 });
await client.api.Email.get({ ids: unread.resultRef("/ids") });
`,
        (messages) => messages.some((message) => message.type === "waiting"),
      ),
    );

    const made = requests(result.messages);
    expect(made.map(({ kind }) => kind)).toEqual(["session", "request"]);
    expect(result.messages.at(-1)).toEqual({ type: "waiting" });
  });

  it("reports an import of another module", async () => {
    const result = track(
      await runUntil(`import { helper } from "./helpers.ts"; console.log(helper);`, (messages) =>
        messages.some((message) => message.type === "error"),
      ),
    );

    expect(errorMessages(result.messages)).toEqual([
      expect.stringContaining('Only imports from "json-meta-client" are available'),
    ]);
  });

  it("reports an import whose module name is not a literal", async () => {
    const result = track(
      await runUntil(`const name = "json-meta-client"; await import(name);`, (messages) =>
        messages.some((message) => message.type === "error"),
      ),
    );

    expect(errorMessages(result.messages)).toEqual([
      expect.stringContaining("with a literal module name"),
    ]);
  });

  it("reports a syntax error", async () => {
    const result = track(
      await runUntil("const = 1;", (messages) =>
        messages.some((message) => message.type === "error"),
      ),
    );

    expect(errorMessages(result.messages)[0]).toContain("TS");
  });

  it("reports an uncaught runtime error", async () => {
    const result = track(
      await runUntil(`throw new Error("boom");`, (messages) =>
        messages.some((message) => message.type === "error"),
      ),
    );

    expect(errorMessages(result.messages)[0]).toContain("boom");
  });

  it("stops waiting for a response once an error is reported", async () => {
    const result = track(
      await runUntil(
        `
void fetch("https://example.test/thing", { method: "POST", body: "hi" });
throw new Error("boom");
`,
        (messages) =>
          messages.some((message) => message.type === "error") &&
          messages.some((message) => message.type === "request"),
      ),
    );

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(result.messages.some((message) => message.type === "waiting")).toBe(false);
  });

  it("records upload, download, and event-stream requests and leaves them pending", async () => {
    const result = track(
      await runUntil(
        `
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: "<token>",
  capabilities: ["mail"],
});

void client.blob.download({ blobId: "B1", name: "a.txt", type: "text/plain" });
void client.blob.upload("hello");
void client.onStateChange(() => {});
`,
        (messages) => {
          const kinds = new Set(requests(messages).map(({ kind }) => kind));
          return (
            kinds.has("upload") &&
            kinds.has("download") &&
            kinds.has("eventSource") &&
            messages.some((message) => message.type === "waiting")
          );
        },
      ),
    );

    expect(requests(result.messages).map(({ kind }) => kind)).toEqual(
      expect.arrayContaining(["session", "download", "upload", "eventSource"]),
    );
    expect(errorMessages(result.messages)).toEqual([]);
  });

  it("restores the environment when stopped", () => {
    const originalFetch = globalThis.fetch;
    const { handle } = run("");

    expect(globalThis.fetch).not.toBe(originalFetch);
    handle.stop();
    expect(globalThis.fetch).toBe(originalFetch);
  });

  it("runs the Extending example without a capability warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const source = await example("../../advanced/extending.md");
      const result = track(
        await runUntil(source, (messages) =>
          messages.some((message) => message.type === "waiting"),
        ),
      );

      const request = requests(result.messages).find(({ kind }) => kind === "request");
      expect(request?.body).toMatchObject({
        using: expect.arrayContaining(["urn:example:notes"]),
      });
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
