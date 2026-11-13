import { afterEach, describe, expect, it, vi } from "vitest";

import { JsonMetaClient } from "../../../src/index.ts";
import { PLACEHOLDER_ACCOUNT_ID, recordingFetch, seedCallIds } from "./index.ts";
import type { Recorder } from "./index.ts";

const sessionUrl = "https://jmap.example.com/.well-known/jmap";

/**
 * Wait for a macrotask, letting the client finish what it can
 */
const macrotask = () => new Promise((resolve) => setTimeout(resolve, 0));

function clientRecordedBy(recorder: Recorder) {
  vi.stubGlobal("fetch", recorder.fetch);
  return new JsonMetaClient({ sessionUrl, auth: "<token>", capabilities: ["mail"] });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe(recordingFetch, () => {
  it("answers a Session fetch with a placeholder Session for the requested origin", async () => {
    const recorder = recordingFetch();

    const response = await recorder.fetch(sessionUrl);
    const session = await response.json();

    expect(session.apiUrl).toBe("https://jmap.example.com/jmap/api");
    expect(session.primaryAccounts["urn:ietf:params:jmap:mail"]).toBe(PLACEHOLDER_ACCOUNT_ID);
    expect(Object.keys(session.capabilities)).toContain("urn:ietf:params:jmap:core");
    expect((await recorder.settled()).map(({ kind, url }) => ({ kind, url }))).toEqual([
      { kind: "session", url: sessionUrl },
    ]);
  });

  it("records a JMAP Request and leaves it pending", async () => {
    const recorder = recordingFetch();
    const client = clientRecordedBy(recorder);
    const settled = vi.fn<() => void>();

    client.api.Email.query({ limit: 5 }).then(settled, settled);
    await macrotask();

    const [, request] = await recorder.settled();
    expect(request).toMatchObject({
      kind: "request",
      method: "POST",
      url: "https://jmap.example.com/jmap/api",
      body: {
        using: ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
        methodCalls: [
          ["Email/query", { accountId: PLACEHOLDER_ACCOUNT_ID, limit: 5 }, expect.any(String)],
        ],
      },
    });
    expect(settled).not.toHaveBeenCalled();
  });

  it("recognizes a placeholder Session's blob and event-stream URLs", async () => {
    const recorder = recordingFetch();
    const client = clientRecordedBy(recorder);
    const settled = vi.fn<() => void>();

    client.blob
      .download({ blobId: "B1", name: "a.txt", type: "text/plain" })
      .then(settled, settled);
    client.blob.upload("hello").then(settled, settled);
    // Resolves once the event stream is opened, not once it connects
    const subscription = await client.onStateChange(() => {});
    await vi.waitFor(() => expect(recorder.count).toBe(4));

    const recorded = await recorder.settled();
    expect(recorded.map(({ kind, method, url }) => ({ kind, method, url }))).toEqual([
      { kind: "session", method: "GET", url: sessionUrl },
      {
        kind: "download",
        method: "GET",
        url: "https://jmap.example.com/jmap/download/%3Caccount-id%3E/B1/a.txt?type=text%2Fplain",
      },
      {
        kind: "upload",
        method: "POST",
        url: "https://jmap.example.com/jmap/upload/%3Caccount-id%3E",
      },
      {
        kind: "eventSource",
        method: "GET",
        url: "https://jmap.example.com/jmap/eventsource/?types=*&closeafter=no&ping=30",
      },
    ]);
    expect(settled).not.toHaveBeenCalled();
    subscription[Symbol.dispose]();
  });
});

describe("custom capabilities", () => {
  it("includes supported capability URNs in later placeholder Sessions", async () => {
    const recorder = recordingFetch();
    recorder.supportCapabilities(["https://example.com/jmap/notes"]);

    const response = await recorder.fetch(sessionUrl);
    const session = await response.json();

    expect(Object.keys(session.capabilities)).toContain("https://example.com/jmap/notes");
    expect(session.primaryAccounts["https://example.com/jmap/notes"]).toBe(PLACEHOLDER_ACCOUNT_ID);
  });
});

async function recordCallIds(seed: number) {
  const restore = seedCallIds(seed);
  try {
    const recorder = recordingFetch();
    const client = clientRecordedBy(recorder);
    void client.api.Email.query({});
    void client.api.Mailbox.get({});
    await macrotask();
    const recorded = await recorder.settled();
    const request = recorded.find(({ kind }) => kind === "request");
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const { methodCalls } = (request?.body ?? {}) as { methodCalls: [string, unknown, string][] };
    return methodCalls.map(([, , id]) => id);
  } finally {
    restore();
  }
}

describe(seedCallIds, () => {
  it("gives call ids their real shape, identical for the same seed", async () => {
    const first = await recordCallIds(1);
    const second = await recordCallIds(1);

    expect(first).toEqual([
      expect.stringMatching(/^Email\/query::[0-9a-f]{8}$/),
      expect.stringMatching(/^Mailbox\/get::[0-9a-f]{8}$/),
    ]);
    expect(second).toEqual(first);
    expect(await recordCallIds(2)).not.toEqual(first);
  });

  it("restores random values", () => {
    const restore = seedCallIds(1);
    restore();

    const draws = [0, 1].map(() => crypto.getRandomValues(new Uint32Array(4)).join());
    seedCallIds(1)();
    const afterReseed = crypto.getRandomValues(new Uint32Array(4)).join();

    expect(new Set([...draws, afterReseed]).size).toBe(3);
  });
});
