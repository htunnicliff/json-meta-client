import { describe, expect, it } from "vitest";

import homeRequest from "../../../snippets/home-request.md?raw";
import type { RecordedRequest } from "../../recorder/index.ts";
import { annotateRequest, buildTimeline } from "../timeline.ts";
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
  it("labels method calls and links result references", () => {
    const [session, batch] = buildTimeline(recorded(homeBody));

    expect(session).toEqual({
      kind: "session",
      key: "session-0",
      index: 0,
      method: "GET",
      url: sessionUrl,
    });
    expect(batch).toMatchObject({
      kind: "batch",
      key: "batch-1",
      number: 1,
      calls: [
        {
          label: "#1",
          name: "Email/query",
          callId: "Email/query::f3c9ebfd",
          referencedBy: ["#2"],
          references: {},
        },
        { label: "#2", name: "Email/get", referencedBy: [], references: { "#ids": "#1" } },
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

describe(annotateRequest, () => {
  it("writes the request exactly as sent", () => {
    const lines = annotateRequest(batchOf(buildTimeline(recorded(homeBody))));

    expect(lines.map(({ text }) => text).join("\n")).toBe(JSON.stringify(homeBody, null, 2));
  });

  it("notes method calls and the result references between them", () => {
    const lines = annotateRequest(batchOf(buildTimeline(recorded(homeBody))));
    const notes = lines.flatMap(({ text, note }) => (note ? [[text.trim(), note.text]] : []));

    expect(notes).toEqual([
      ["[", "#1 Email/query"],
      ['"Email/query::f3c9ebfd"', "referenced by #2"],
      ["[", "#2 Email/get"],
      ['"#ids": {', "result of #1"],
    ]);
  });

  it("ties each line of a method call to its label", () => {
    const lines = annotateRequest(batchOf(buildTimeline(recorded(homeBody))));
    const labelOf = (text: string) => lines.find((line) => line.text.trim() === text)?.call;

    expect(labelOf('"using": [')).toBeUndefined();
    expect(labelOf('"Email/query",')).toBe("#1");
    expect(labelOf('"path": "/ids"')).toBe("#2");
  });
});
