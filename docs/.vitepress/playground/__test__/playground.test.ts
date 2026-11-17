import { Worker } from "node:worker_threads";

import { describe, expect, it } from "vitest";

import homeRequest from "../../../snippets/home-request.md?raw";
import { PLACEHOLDER_ACCOUNT_ID } from "../../recorder/index.ts";
import type { RecordedRequest } from "../../recorder/index.ts";
import { compile } from "../compile.ts";
import { defaultExample } from "../examples.ts";
import { SHIM_SPECIFIER } from "../protocol.ts";
import type { RunEvent } from "../protocol.ts";
import { run } from "../run.ts";
import { createShim } from "../shim.ts";

function compiled(source: string): string {
  const output = compile(source);
  if ("diagnostics" in output) throw new Error(JSON.stringify(output.diagnostics));
  return output.code;
}

/**
 * Run code in a worker thread until it is idle, and return what it did by then
 */
async function runUntilIdle(source: string) {
  const worker = new Worker(new URL("node-run-worker.ts", import.meta.url), {
    workerData: { code: compiled(source) },
  });
  const messages: RunEvent[] = [];
  try {
    const { finished } = await new Promise<{ finished: boolean }>((resolve, reject) => {
      worker.on("error", reject);
      worker.on("message", (message: RunEvent) => {
        messages.push(message);
        if (message.type === "idle") resolve(message);
        if (message.type === "error") reject(new Error(message.message));
      });
    });
    const requests: RecordedRequest[] = [];
    const logs: string[] = [];
    for (const message of messages) {
      if (message.type === "request") requests[message.index] = message.request;
      if (message.type === "console") logs.push(`${message.level}: ${message.text}`);
    }
    return { finished, requests, logs };
  } finally {
    await worker.terminate();
  }
}

const jmapRequests = (requests: RecordedRequest[]) =>
  requests.filter(({ kind }) => kind === "request").map(({ body }) => body);

describe(compile, () => {
  it("points imports of the library at the shim", () => {
    const code = compiled(
      'import { JsonMetaClient } from "json-meta-client";\nconst lib = await import("json-meta-client");\nconsole.log(JsonMetaClient, lib);',
    );

    expect(code).toContain(`from "${SHIM_SPECIFIER}"`);
    expect(code).toContain(`import("${SHIM_SPECIFIER}")`);
    expect(code).not.toContain('"json-meta-client"');
  });

  it("reports any other import, with its location", () => {
    expect(compile('const a = 1;\nimport { z } from "zod";\nconsole.log(z, a);')).toEqual({
      diagnostics: [
        {
          message: 'The playground can only import "json-meta-client", not "zod"',
          line: 2,
          column: 19,
        },
      ],
    });
  });

  it("allows type-only imports of other modules", () => {
    expect(compile('import type { Except } from "type-fest";\nlet a: Except<{}, never>;')).toEqual({
      code: expect.any(String),
      source: expect.any(Object),
    });
  });

  it("reports syntax errors", () => {
    expect(compile("const a = ;")).toEqual({
      diagnostics: [{ message: "Expression expected.", line: 1, column: 11 }],
    });
  });
});

describe(run, () => {
  it("makes the same JMAP Request for the home page example as its generated tab", async () => {
    const tab = /```json \[JMAP Request[^\n]*\n([\s\S]*?)^```/m.exec(homeRequest)?.[1];

    const { finished, requests } = await runUntilIdle(defaultExample);

    expect(finished).toBe(false);
    expect(jmapRequests(requests)).toEqual([JSON.parse(tab!)]);
  });

  it("stops after the first Batch when calls are awaited in turn", async () => {
    const { finished, requests } = await runUntilIdle(`
      const { ids } = await client.api.Email.query({ limit: 5 });
      await client.api.Email.get({ ids });
    `);

    expect(finished).toBe(false);
    expect(requests.map(({ kind }) => kind)).toEqual(["session", "request"]);
    expect(jmapRequests(requests)).toEqual([
      expect.objectContaining({
        methodCalls: [["Email/query", expect.anything(), expect.any(String)]],
      }),
    ]);
  });

  it("adds custom capabilities to the placeholder Session, so no warning appears", async () => {
    const { requests, logs } = await runUntilIdle(`
      import { defineCapability, JsonMetaClient } from "json-meta-client";

      const tasks = defineCapability({ urn: "urn:example:tasks", entities: ["Task"] });
      const client = new JsonMetaClient({
        auth: "<token>",
        sessionUrl: "https://tasks.example.com/.well-known/jmap",
        capabilities: [tasks],
      });

      await client.api.Task.get({ ids: ["task-1"] });
    `);

    expect(jmapRequests(requests)).toEqual([
      {
        using: ["urn:ietf:params:jmap:core", "urn:example:tasks"],
        methodCalls: [
          ["Task/get", { ids: ["task-1"], accountId: PLACEHOLDER_ACCOUNT_ID }, expect.any(String)],
        ],
      },
    ]);
    expect(logs).toEqual([]);
  });

  it("records blob and event-stream requests and leaves them pending", async () => {
    const { requests } = await runUntilIdle(`
      const accountId = "${PLACEHOLDER_ACCOUNT_ID}";
      void client.blob.upload("hello", { accountId });
      void client.blob.download({ accountId, blobId: "B1", name: "a.txt", type: "text/plain" });
      await client.onStateChange(() => {});
    `);

    expect(requests.map(({ kind }) => kind)).toEqual([
      "session",
      "upload",
      "download",
      "eventSource",
    ]);
  });

  it("reports when the code finishes", async () => {
    const { finished, requests } = await runUntilIdle("void client.api.Mailbox.get({});");

    expect(finished).toBe(true);
    expect(requests.map(({ kind }) => kind)).toEqual(["session", "request"]);
  });

  it("forwards console calls as readable text", async () => {
    const { logs } = await runUntilIdle(`
      console.log("found", { subject: "Hi", ids: [1, 2] });
      console.warn(new Map([["a", 1]]));
    `);

    expect(logs).toEqual([
      'log: found { subject: "Hi", ids: [1, 2] }',
      'warn: Map(1) { "a" => 1 }',
    ]);
  });

  it("forwards the library's capability warning", async () => {
    const { logs } = await runUntilIdle(`
      const original = globalThis.fetch;
      globalThis.fetch = async (input, init) => {
        const response = await original(input, init);
        if (new Request(input).url.endsWith("/.well-known/jmap")) {
          const session = await response.json();
          delete session.capabilities["urn:ietf:params:jmap:mail"];
          for (const account of Object.values(session.accounts)) {
            delete account.accountCapabilities["urn:ietf:params:jmap:mail"];
          }
          return Response.json(session);
        }
        return response;
      };
      await client.api.Email.query({});
    `);

    expect(logs).toEqual([expect.stringMatching(/^warn: ConfigurationError: .*NOT found/)]);
  });

  it("reports an error the code throws", async () => {
    await expect(runUntilIdle('throw new TypeError("nope");')).rejects.toThrow("TypeError: nope");
  });
});

/**
 * A client of the shimmed library that records the URL and credentials of
 * its Session fetch, then stops
 */
function clientRecording(
  urls: string[],
  shim: ReturnType<typeof createShim>,
  options: { sessionUrl: string; auth: string },
) {
  return new shim.JsonMetaClient({
    capabilities: ["mail"],
    ...options,
    hooks: {
      beforeFetch: [
        ({ request }) => {
          urls.push(`${request.url} ${request.headers.get("authorization")}`);
          throw new Error("stop");
        },
      ],
    },
  });
}

describe(createShim, () => {
  it("fills in the placeholders of each client with a connected server", async () => {
    const urls: string[] = [];
    const shim = createShim(() => {}, {
      sessionUrl: "https://real.example.com/jmap",
      auth: "secret",
    });
    const client = clientRecording(urls, shim, {
      sessionUrl: "<server>",
      auth: "<token>",
    });

    await expect(client.session).rejects.toThrow("stop");
    expect(urls).toEqual(["https://real.example.com/jmap Bearer secret"]);
  });

  it("keeps options that aren't placeholders, even with a connected server", async () => {
    const urls: string[] = [];
    const shim = createShim(() => {}, {
      sessionUrl: "https://real.example.com/jmap",
      auth: "secret",
    });
    const client = clientRecording(urls, shim, {
      sessionUrl: "https://other.example.com/jmap",
      auth: "mine",
    });

    await expect(client.session).rejects.toThrow("stop");
    expect(urls).toEqual(["https://other.example.com/jmap Bearer mine"]);
  });

  it("mocks the server placeholder without a connected server", async () => {
    const urls: string[] = [];
    const client = clientRecording(
      urls,
      createShim(() => {}),
      {
        sessionUrl: "<server>",
        auth: "<token>",
      },
    );

    await expect(client.session).rejects.toThrow("stop");
    expect(urls).toEqual(["https://jmap.example.com/ Bearer <token>"]);
  });
});
