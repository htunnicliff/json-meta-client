import { describe, expect, it } from "vitest";

import { parseEventStream } from "../sse-reader.ts";
import type { EventStreamItem } from "../sse-reader.ts";

async function* chunksOf(...chunks: string[]): AsyncGenerator<string> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

async function parse(...chunks: string[]): Promise<EventStreamItem[]> {
  return Array.fromAsync(parseEventStream(chunksOf(...chunks)));
}

const message = (
  data: string,
  extra: Partial<Pick<EventStreamItem & { type: "message" }, "event" | "lastEventId">> = {},
): EventStreamItem => ({
  type: "message",
  event: "message",
  data,
  lastEventId: "",
  ...extra,
});

describe(parseEventStream, () => {
  it.each([
    { ending: "LF", text: "data: a\n\ndata: b\n\n" },
    { ending: "CRLF", text: "data: a\r\n\r\ndata: b\r\n\r\n" },
    { ending: "CR", text: "data: a\r\rdata: b\r\r" },
    { ending: "mixed", text: "data: a\r\n\ndata: b\r\r\n" },
  ])("splits lines on $ending", async ({ text }) => {
    await expect(parse(text)).resolves.toEqual([message("a"), message("b")]);
  });

  it("joins a line split across chunks", async () => {
    await expect(parse("da", "ta: hel", "lo\n", "\n")).resolves.toEqual([message("hello")]);
  });

  it("treats a CRLF split across chunks as one line ending", async () => {
    await expect(parse("data: a\r", "\n\r", "\ndata: b\r", "", "\n\r\n")).resolves.toEqual([
      message("a"),
      message("b"),
    ]);
  });

  it("joins multi-line data with LF and drops the final LF", async () => {
    await expect(parse("data: one\ndata:two\ndata\n\n")).resolves.toEqual([message("one\ntwo\n")]);
  });

  it("strips only one space after the colon", async () => {
    await expect(parse("data:  padded\n\n")).resolves.toEqual([message(" padded")]);
  });

  it("reads the event type, and resets it after each dispatch", async () => {
    await expect(parse("event: state\ndata: a\n\ndata: b\n\n")).resolves.toEqual([
      message("a", { event: "state" }),
      message("b"),
    ]);
  });

  it("ignores comments and unknown fields", async () => {
    await expect(parse(": ping\nfoo: bar\ndata: a\n\n")).resolves.toEqual([message("a")]);
  });

  it("keeps the last event ID across events, and ignores an ID containing NUL", async () => {
    await expect(parse("id: 1\ndata: a\n\ndata: b\n\nid: x\0y\ndata: c\n\n")).resolves.toEqual([
      message("a", { lastEventId: "1" }),
      message("b", { lastEventId: "1" }),
      message("c", { lastEventId: "1" }),
    ]);
  });

  it("reports an ID change at a blank line that dispatches no event", async () => {
    await expect(parse("id: 7\n\n\nid:\n\n")).resolves.toEqual([
      { type: "id", lastEventId: "7" },
      { type: "id", lastEventId: "" },
    ]);
  });

  it("reports a retry made only of digits", async () => {
    await expect(
      parse("retry: 1500\nretry: 1.5\nretry: -1\nretry:\nretry: 10s\n"),
    ).resolves.toEqual([{ type: "retry", milliseconds: 1500 }]);
  });

  it("drops a leading byte order mark, even in its own chunk", async () => {
    const bom = String.fromCodePoint(0xfeff);
    await expect(parse(`${bom}data: a\n\n`)).resolves.toEqual([message("a")]);
    await expect(parse("", bom, "data: a\n\n")).resolves.toEqual([message("a")]);
    await expect(parse(`data: ${bom}a\n\n`)).resolves.toEqual([message(`${bom}a`)]);
  });

  it("dispatches nothing for an event without a closing blank line", async () => {
    await expect(parse("data: a\n\ndata: unfinished\n")).resolves.toEqual([message("a")]);
    await expect(parse("data: unfinished")).resolves.toEqual([]);
  });

  it("dispatches nothing for an event without data", async () => {
    await expect(parse("event: state\n\ndata: a\n\n")).resolves.toEqual([message("a")]);
  });
});
