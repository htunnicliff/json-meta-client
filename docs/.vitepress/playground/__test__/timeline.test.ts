import { describe, expect, it } from "vitest";

import homeRequest from "../../../snippets/home-request.md?raw";
import { PLACEHOLDER_ACCOUNT_ID } from "../../recorder/index.ts";
import type { RecordedRequest } from "../../recorder/index.ts";
import { annotateRequest, buildTimeline, compactJson } from "../timeline.ts";
import type { BatchEntry } from "../timeline.ts";

const homeBody: unknown = JSON.parse(
  /```json \[JMAP Request[^\n]*\n([\s\S]*?)^```/m.exec(homeRequest)![1],
);

const sessionUrl = "https://jmap.example.com/.well-known/jmap";
const apiUrl = "https://jmap.example.com/jmap/api";

const recorded = (body: unknown): RecordedRequest[] => [
  { kind: "session", method: "GET", url: sessionUrl },
  { kind: "request", method: "POST", url: apiUrl, body },
];

const call = (name: string, id: string) => [name, {}, id];

const batchOf = (entries: ReturnType<typeof buildTimeline>) =>
  entries.find((entry): entry is BatchEntry => entry.kind === "batch")!;

describe(buildTimeline, () => {
  it("labels method calls, tags filled-in account ids, and links result references", () => {
    const [session, batch] = buildTimeline(recorded(homeBody));

    expect(session).toEqual({ kind: "session", key: "session-0", method: "GET", url: sessionUrl });
    expect(batch).toMatchObject({
      kind: "batch",
      key: "batch-1",
      number: 1,
      using: ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
      references: 1,
      calls: [
        {
          label: "#1",
          name: "Email/query",
          callId: "Email/query::f3c9ebfd",
          referencedBy: ["#2"],
          args: [
            { key: "filter", value: { notKeyword: "$seen" } },
            { key: "limit", value: 5 },
            { key: "accountId", value: PLACEHOLDER_ACCOUNT_ID, fromSession: true },
          ],
        },
        {
          label: "#2",
          name: "Email/get",
          referencedBy: [],
          args: [
            {
              key: "#ids",
              reference: {
                label: "#1",
                name: "Email/query",
                path: "/ids",
                resultOf: "Email/query::f3c9ebfd",
              },
            },
            { key: "properties", value: ["subject", "from"] },
            { key: "accountId", fromSession: true },
          ],
        },
      ],
    });
  });

  it("numbers method calls across Batches, and gives other requests their own entries", () => {
    const entries = buildTimeline([
      { kind: "session", method: "GET", url: sessionUrl },
      {
        kind: "request",
        method: "POST",
        url: apiUrl,
        body: { using: [], methodCalls: [call("A/get", "a")] },
      },
      { kind: "upload", method: "POST", url: "https://jmap.example.com/upload", body: "hello" },
      {
        kind: "request",
        method: "POST",
        url: apiUrl,
        body: { using: [], methodCalls: [call("B/get", "b")] },
      },
    ]);

    expect(entries.map(({ key }) => key)).toEqual(["session-0", "batch-1", "upload-1", "batch-2"]);
    expect(
      entries
        .flatMap((entry) => (entry.kind === "batch" ? entry.calls : []))
        .map(({ label }) => label),
    ).toEqual(["#1", "#2"]);
  });
});

describe(compactJson, () => {
  it("writes JSON on one line, with plain keys unquoted", () => {
    expect(compactJson({ notKeyword: "$seen", "a-b": [1, null], empty: {} })).toBe(
      '{ notKeyword: "$seen", "a-b": [1, null], empty: {} }',
    );
  });
});

describe(annotateRequest, () => {
  it("writes the request exactly as sent", () => {
    const lines = annotateRequest(batchOf(buildTimeline(recorded(homeBody))));

    expect(lines.map(({ text }) => text).join("\n")).toBe(JSON.stringify(homeBody, null, 2));
  });

  it("notes where values came from", () => {
    const lines = annotateRequest(batchOf(buildTimeline(recorded(homeBody))));
    const notes = lines.flatMap(({ text, note }) => (note ? [[text.trim(), note.text]] : []));

    expect(notes).toEqual([
      ['"urn:ietf:params:jmap:core",', "always sent"],
      ['"urn:ietf:params:jmap:mail"', "from the client's capabilities"],
      ["[", "#1 Email/query"],
      ['"accountId": "<account-id>"', "from session.primaryAccounts"],
      ['"Email/query::f3c9ebfd"', "referenced by #2"],
      ["[", "#2 Email/get"],
      ['"#ids": {', "result of #1"],
      ['"accountId": "<account-id>"', "from session.primaryAccounts"],
    ]);
  });
});
