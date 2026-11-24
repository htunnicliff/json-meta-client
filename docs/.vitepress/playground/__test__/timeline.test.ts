import { describe, expect, it } from "vitest";

import type { RecordedRequest } from "../../recorder/index.ts";
import { annotateRequest, buildTimeline, jsonLines } from "../timeline.ts";
import type { BatchEntry } from "../timeline.ts";
import { homeRequestBody } from "./home-request-body.ts";

const homeBody: unknown = homeRequestBody;

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
          label: "unread",
          name: "Email/query",
          callId: "unread",
          referencedBy: ["emails"],
          references: {},
        },
        {
          label: "emails",
          name: "Email/get",
          referencedBy: [],
          references: { "#ids": "unread" },
        },
      ],
    });
  });

  it("numbers unnamed method calls across Batches, and gives other requests their own entries", () => {
    const entries = buildTimeline([
      { kind: "session", method: "GET", url: sessionUrl },
      {
        kind: "request",
        method: "POST",
        url: apiUrl,
        body: { using: [], methodCalls: [call("A/get", "A/get::0a1b2c3d")] },
      },
      { kind: "upload", method: "POST", url: "https://jmap.example.com/upload", body: "hello" },
      {
        kind: "request",
        method: "POST",
        url: apiUrl,
        body: { using: [], methodCalls: [call("B/get", "B/get::4e5f6a7b")] },
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

  it("marks each call id and links each result reference to it", () => {
    const lines = annotateRequest(batchOf(buildTimeline(recorded(homeBody))));

    expect(lines.filter(({ callId }) => callId).map(({ text }) => text.trim())).toEqual([
      '"unread"',
      '"emails"',
    ]);
    expect(lines.flatMap(({ text, link }) => (link ? [[text.trim(), link]] : []))).toEqual([
      [
        '"#ids": {',
        {
          from: { label: "unread", name: "Email/query", order: 0 },
          to: { label: "emails", name: "Email/get", order: 1 },
          key: "#ids",
          path: "/ids",
        },
      ],
    ]);
  });

  it("links a result reference to a call in an earlier Batch", () => {
    const query = ["Email/query", {}, "Email/query::0a1b2c3d"];
    const get = [
      "Email/get",
      { "#ids": { name: "Email/query", path: "/ids", resultOf: "Email/query::0a1b2c3d" } },
      "Email/get::4e5f6a7b",
    ];
    const entries = buildTimeline([
      { kind: "request", method: "POST", url: apiUrl, body: { using: [], methodCalls: [query] } },
      { kind: "request", method: "POST", url: apiUrl, body: { using: [], methodCalls: [get] } },
    ]);
    const second = entries.filter((entry): entry is BatchEntry => entry.kind === "batch")[1];

    expect(annotateRequest(second).flatMap(({ link }) => link ?? [])).toEqual([
      {
        from: { label: "#1", name: "Email/query", order: 0 },
        to: { label: "#2", name: "Email/get", order: 1 },
        key: "#ids",
        path: "/ids",
      },
    ]);
  });

  it("ties each line of a method call to its label", () => {
    const lines = annotateRequest(batchOf(buildTimeline(recorded(homeBody))));
    const labelOf = (text: string) => lines.find((line) => line.text.trim() === text)?.call;

    expect(labelOf('"using": [')).toBeUndefined();
    expect(labelOf('"Email/query",')).toBe("unread");
    expect(labelOf('"path": "/ids"')).toBe("emails");
  });
});

describe(jsonLines, () => {
  it("writes any value exactly as JSON.stringify does", () => {
    const value = { a: [1, true, null], b: {}, c: [], "d e": "f" };

    expect(
      jsonLines(value)
        .map(({ text }) => text)
        .join("\n"),
    ).toBe(JSON.stringify(value, null, 2));
  });

  it("splits each line into tokens for highlighting", () => {
    const kinds = jsonLines({ id: "a", n: 1, ok: false, list: [null] }).map(({ tokens }) =>
      tokens.flatMap(({ text, kind }) => (kind ? [[kind, text]] : [])),
    );

    expect(kinds).toEqual([
      [["punctuation", "{"]],
      [
        ["key", '"id"'],
        ["punctuation", ":"],
        ["string", '"a"'],
        ["punctuation", ","],
      ],
      [
        ["key", '"n"'],
        ["punctuation", ":"],
        ["number", "1"],
        ["punctuation", ","],
      ],
      [
        ["key", '"ok"'],
        ["punctuation", ":"],
        ["literal", "false"],
        ["punctuation", ","],
      ],
      [
        ["key", '"list"'],
        ["punctuation", ":"],
        ["punctuation", "["],
      ],
      [["literal", "null"]],
      [["punctuation", "]"]],
      [["punctuation", "}"]],
    ]);
  });
});
