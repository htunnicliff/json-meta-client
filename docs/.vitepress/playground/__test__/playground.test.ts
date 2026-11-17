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
    return { finished, requests, logs, messages };
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

    const { finished, requests, messages } = await runUntilIdle(defaultExample);

    expect(finished).toBe(false);
    expect(jmapRequests(requests)).toEqual([JSON.parse(tab!)]);
    expect(messages.some(({ type }) => type === "hook")).toBe(false);
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
        auth: "<credentials>",
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

  it("links configured hooks to the Session and batch even when a hook rewrites the Request URL", async () => {
    const { messages } = await runUntilIdle(`
      import { JsonMetaClient } from "json-meta-client";
      const client = new JsonMetaClient({
        auth: "<token>", sessionUrl: "<server>/.well-known/jmap", capabilities: ["mail"],
        hooks: {
          beforeJmapRequest: [function first({ request }) { return request; }, ({ request }) => request],
          beforeFetch: [async ({ request }) => new Request(request.url + "?rewrite", {
            method: request.method,
            headers: request.headers,
            body: request.body ? await request.text() : undefined,
          })],
          afterFetch: [({ response }) => response],
          afterJmapResponse: [({ response }) => response],
          beforeEventSourceConnect: [({ request }) => request],
        },
      });
      await client.api.Mailbox.get({});
    `);

    const requests = messages.filter((event) => event.type === "request");
    const hooks = messages.filter((event) => event.type === "hook");
    expect(requests.map(({ request }) => request.kind)).toEqual(["session", "request"]);
    expect(requests[1].request.url).toMatch(/\?rewrite$/);
    const callsFor = (request: (typeof requests)[number]) =>
      hooks
        .filter(({ operation }) => operation === request.operation)
        .map(({ call }) => [call.name, call.position, call.callback, call.status]);
    expect(callsFor(requests[0])).toEqual([
      ["beforeFetch", 1, "", "running"],
      ["beforeFetch", 1, "", "completed"],
      ["afterFetch", 1, "", "running"],
      ["afterFetch", 1, "", "completed"],
    ]);
    expect(callsFor(requests[1])).toEqual([
      ["beforeJmapRequest", 1, "first", "running"],
      ["beforeJmapRequest", 1, "first", "completed"],
      ["beforeJmapRequest", 2, "", "running"],
      ["beforeJmapRequest", 2, "", "completed"],
      ["beforeFetch", 1, "", "running"],
      ["beforeFetch", 1, "", "completed"],
    ]);
  });

  it("reports a hook failure before sending a batch, even when user code catches it", async () => {
    const { messages, requests } = await runUntilIdle(`
      import { JsonMetaClient } from "json-meta-client";
      const client = new JsonMetaClient({
        auth: "<token>", sessionUrl: "<server>/.well-known/jmap", capabilities: ["mail"],
        hooks: { beforeJmapRequest: [async () => {
          await Promise.resolve();
          throw new Error("stopped by hook");
        }] },
      });
      await client.api.Mailbox.get({}).catch(() => {});
    `);

    expect(requests.map(({ kind }) => kind)).toEqual(["session"]);
    const hooks = messages.filter((event) => event.type === "hook");
    expect(hooks).toMatchObject([
      { target: { kind: "batch" }, call: { name: "beforeJmapRequest", status: "running" } },
      {
        target: { kind: "batch" },
        call: { name: "beforeJmapRequest", status: "failed", message: "Error: stopped by hook" },
      },
    ]);
    expect(hooks[0].operation).toBe(hooks[1].operation);
  });

  it("keeps a waiting hook on its own batch when an isolated batch reaches fetch first", async () => {
    const { messages } = await runUntilIdle(`
      import { JsonMetaClient } from "json-meta-client";
      const client = new JsonMetaClient({
        auth: "<token>", sessionUrl: "<server>/.well-known/jmap", capabilities: ["mail"],
        hooks: { beforeJmapRequest: [async ({ request }) => {
          if (request.methodCalls[0][0] === "Mailbox/get") await new Promise(() => {});
          return request;
        }] },
      });
      await client.session;
      void client.api.Mailbox.get({});
      client.isolated((api) => { void api.Email.query({}); });
    `);

    const hooks = messages.filter((event) => event.type === "hook");
    const batch = messages.find(
      (event) => event.type === "request" && event.request.kind === "request",
    );
    expect(batch).toMatchObject({ operation: hooks[1].operation });
    expect(hooks.map(({ operation, call }) => [operation, call.status])).toEqual([
      [hooks[0].operation, "running"],
      [hooks[1].operation, "running"],
      [hooks[1].operation, "completed"],
    ]);
    expect(hooks[0].operation).not.toBe(hooks[1].operation);
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
  options: { sessionUrl: string; auth: string | { username: string; password: string } },
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
  it.each([
    { auth: "secret", header: "Bearer secret" },
    { auth: { username: "user", password: "secret" }, header: "Basic dXNlcjpzZWNyZXQ=" },
  ])(
    "fills in the placeholders with connected credentials for $header",
    async ({ auth, header }) => {
      const urls: string[] = [];
      const shim = createShim(() => {}, {
        sessionUrl: "https://real.example.com/jmap",
        auth,
      });
      const client = clientRecording(urls, shim, {
        sessionUrl: "<server>",
        auth: "<credentials>",
      });

      await expect(client.session).rejects.toThrow("stop");
      expect(urls).toEqual([`https://real.example.com/jmap ${header}`]);
    },
  );

  it.each([
    { auth: "mine", header: "Bearer mine" },
    { auth: { username: "user", password: "mine" }, header: "Basic dXNlcjptaW5l" },
  ])(
    "keeps explicit credentials for $header even with a connected server",
    async ({ auth, header }) => {
      const urls: string[] = [];
      const shim = createShim(() => {}, {
        sessionUrl: "https://real.example.com/jmap",
        auth: "secret",
      });
      const client = clientRecording(urls, shim, {
        sessionUrl: "https://other.example.com/jmap",
        auth,
      });

      await expect(client.session).rejects.toThrow("stop");
      expect(urls).toEqual([`https://other.example.com/jmap ${header}`]);
    },
  );

  it("mocks the server placeholder without a connected server", async () => {
    const urls: string[] = [];
    const client = clientRecording(
      urls,
      createShim(() => {}),
      {
        sessionUrl: "<server>",
        auth: "<credentials>",
      },
    );

    await expect(client.session).rejects.toThrow("stop");
    expect(urls).toEqual(["https://jmap.example.com/ Bearer <credentials>"]);
  });
});
