import { describe, expect, it } from "vitest";

import { batchChain } from "../embed/chain.ts";
import { buildTimeline } from "../timeline.ts";
import type { BatchEntry } from "../timeline.ts";

const reference = (resultOf: string, name: string, path: string) => ({ resultOf, name, path });

function batchOf(methodCalls: unknown[]): BatchEntry {
  const [entry] = buildTimeline([
    {
      kind: "request",
      method: "POST",
      url: "https://jmap.example.com/api",
      body: { using: [], methodCalls },
    },
  ]);
  if (entry?.kind !== "batch") throw new Error("Expected a Batch");
  return entry;
}

describe(batchChain, () => {
  it("joins method calls by the result references between them", () => {
    const batch = batchOf([
      ["Email/query", {}, "a"],
      ["Email/get", { "#ids": reference("a", "Email/query", "/ids") }, "b"],
      ["Thread/get", { "#ids": reference("b", "Email/get", "/list/*/threadId") }, "c"],
      ["Mailbox/get", {}, "d"],
    ]);

    expect(batchChain(batch)).toEqual([
      { kind: "call", label: "#1", name: "Email/query" },
      { kind: "reference", path: "/ids" },
      { kind: "call", label: "#2", name: "Email/get" },
      { kind: "reference", path: "/list/*/threadId" },
      { kind: "call", label: "#3", name: "Thread/get" },
      { kind: "call", label: "#4", name: "Mailbox/get" },
    ]);
  });
});
