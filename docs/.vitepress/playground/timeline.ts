import type { RecordedKind, RecordedRequest } from "../recorder/index.ts";

/**
 * Where a run is: not run since the code last changed, running, waiting at a
 * pending `await`, finished, or stopped by an error
 */
export type RunStatus = "ready" | "running" | "waiting" | "finished" | "failed";

/**
 * The timeline the request panel shows, built from the recorded requests of a
 * run in send order
 */
export type TimelineEntry = SessionEntry | BatchEntry | OtherEntry;

interface BaseEntry {
  /** Stable across runs that make the same requests, for keyed rendering */
  key: string;
  /** The position of the request in send order */
  index: number;
  method: string;
  url: string;
}

export interface SessionEntry extends BaseEntry {
  kind: "session";
}

export interface OtherEntry extends BaseEntry {
  kind: Exclude<RecordedKind, "session" | "request">;
  body?: unknown;
}

export interface BatchEntry extends BaseEntry {
  kind: "batch";
  /** 1-based, in send order */
  number: number;
  calls: TimelineCall[];
  /** The JMAP Request exactly as sent */
  body: unknown;
}

export interface TimelineCall {
  /** A label that stays the same between runs, such as `#1`, in send order */
  label: string;
  name: string;
  callId: string;
  /** Labels of later method calls that refer to this one's result */
  referencedBy: string[];
  /**
   * Result reference arguments, such as `#ids`, by key → the label of the
   * method call referred to, or its call id when it is not in the timeline
   */
  references: Record<string, string>;
}

type Invocation = [name: string, args: Record<string, unknown>, callId: string];

function isInvocation(value: unknown): value is Invocation {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    typeof value[0] === "string" &&
    typeof value[2] === "string" &&
    isObject(value[1])
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The call id a result reference argument refers to
function resultOf(value: unknown): string | undefined {
  if (!isObject(value)) return undefined;
  const { name, path, resultOf } = value;
  return typeof name === "string" && typeof path === "string" && typeof resultOf === "string"
    ? resultOf
    : undefined;
}

/**
 * Build the timeline of recorded requests, given in send order. Requests
 * still being recorded may leave gaps.
 */
export function buildTimeline(requests: readonly (RecordedRequest | undefined)[]): TimelineEntry[] {
  const labels = new Map<string, string>();
  const calls = new Map<string, TimelineCall>();
  let batches = 0;
  let others = 0;
  return requests.flatMap((request, index): TimelineEntry | [] => {
    if (!request) return [];
    const base = { index, method: request.method, url: request.url };
    if (request.kind === "session") return { ...base, kind: "session", key: `session-${index}` };
    if (request.kind !== "request") {
      return {
        ...base,
        kind: request.kind,
        key: `${request.kind}-${++others}`,
        body: request.body,
      };
    }
    const number = ++batches;
    const body = isObject(request.body) ? request.body : {};
    const invocations = Array.isArray(body.methodCalls)
      ? body.methodCalls.filter(isInvocation)
      : [];
    const batchCalls = invocations.map(([name, args, callId]): TimelineCall => {
      const label = `#${labels.size + 1}`;
      labels.set(callId, label);
      const references: Record<string, string> = {};
      for (const [key, value] of Object.entries(args)) {
        const target = key.startsWith("#") ? resultOf(value) : undefined;
        if (target === undefined) continue;
        references[key] = labels.get(target) ?? target;
        calls.get(target)?.referencedBy.push(label);
      }
      const call: TimelineCall = { label, name, callId, referencedBy: [], references };
      calls.set(callId, call);
      return call;
    });
    return {
      ...base,
      kind: "batch",
      key: `batch-${number}`,
      number,
      calls: batchCalls,
      body: request.body,
    };
  });
}

/**
 * What a piece of a JSON line is, for syntax highlighting. Whitespace has no
 * kind.
 */
export type TokenKind = "key" | "string" | "number" | "literal" | "punctuation";

export interface Token {
  text: string;
  kind?: TokenKind;
}

/**
 * A line of JSON as `JSON.stringify(value, null, 2)` writes it
 */
export interface JsonLine {
  text: string;
  tokens: Token[];
}

interface WrittenLine extends JsonLine {
  /** Where the value the line opens or holds is, as keys and indexes */
  path: (string | number)[];
  /** Whether the line only closes an object or array */
  closing: boolean;
}

function scalarKind(value: unknown): TokenKind {
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  return "literal";
}

/**
 * Write a JSON value one line at a time, split into tokens
 */
function writeJson(value: unknown): WrittenLine[] {
  const lines: WrittenLine[] = [];

  function write(item: unknown, path: (string | number)[], depth: number, last: boolean) {
    const key = path.at(-1);
    const head: Token[] = [];
    if (depth) head.push({ text: "  ".repeat(depth) });
    if (typeof key === "string") {
      head.push({ text: JSON.stringify(key), kind: "key" }, { text: ":", kind: "punctuation" });
      head.push({ text: " " });
    }
    const comma: Token[] = last ? [] : [{ text: ",", kind: "punctuation" }];
    const push = (tokens: Token[], closing: boolean) =>
      lines.push({ text: tokens.map(({ text }) => text).join(""), tokens, path, closing });

    const entries: [string | number, unknown][] | undefined = Array.isArray(item)
      ? item.map((element, index) => [index, element])
      : isObject(item)
        ? Object.entries(item)
        : undefined;
    if (!entries) {
      push([...head, { text: JSON.stringify(item), kind: scalarKind(item) }, ...comma], false);
      return;
    }
    const [open, close] = Array.isArray(item) ? ["[", "]"] : ["{", "}"];
    if (!entries.length) {
      push([...head, { text: `${open}${close}`, kind: "punctuation" }, ...comma], false);
      return;
    }
    push([...head, { text: open, kind: "punctuation" }], false);
    entries.forEach(([entryKey, entry], index) =>
      write(entry, [...path, entryKey], depth + 1, index === entries.length - 1),
    );
    const indent: Token[] = depth ? [{ text: "  ".repeat(depth) }] : [];
    push([...indent, { text: close, kind: "punctuation" }, ...comma], true);
  }

  write(value, [], 0, true);
  return lines;
}

/**
 * Any JSON value, as `JSON.stringify(value, null, 2)` writes it, one line at
 * a time, split into tokens for highlighting
 */
export function jsonLines(value: unknown): JsonLine[] {
  return writeJson(value).map(({ text, tokens }) => ({ text, tokens }));
}

/**
 * A line of a JMAP Request's JSON: the method call it belongs to, and a note
 * on where a method call starts and on the result references between calls
 */
export interface AnnotatedLine extends JsonLine {
  /** The label of the method call this line is part of */
  call?: string;
  note?: { text: string; tone: "label" | "reference" };
}

/**
 * The note on the line at `path` within a method call: its label where it
 * starts, and the result references it takes part in
 */
function note(path: readonly (string | number)[], call: TimelineCall): AnnotatedLine["note"] {
  const [, , part, key] = path;
  if (path.length === 2) return { text: `${call.label} ${call.name}`, tone: "label" };
  if (part === 2 && path.length === 3 && call.referencedBy.length) {
    return { text: `referenced by ${call.referencedBy.join(", ")}`, tone: "reference" };
  }
  const target = part === 1 && typeof key === "string" ? call.references[key] : undefined;
  if (path.length === 4 && target) return { text: `result of ${target}`, tone: "reference" };
  return undefined;
}

/**
 * The JMAP Request as `JSON.stringify(body, null, 2)` writes it, one line at a
 * time, with notes on its method calls and result references
 */
export function annotateRequest(batch: BatchEntry): AnnotatedLine[] {
  const byId = new Map(batch.calls.map((call) => [call.callId, call]));
  const methodCalls: unknown[] =
    isObject(batch.body) && Array.isArray(batch.body.methodCalls) ? batch.body.methodCalls : [];

  function callAt(path: readonly (string | number)[]): TimelineCall | undefined {
    const [top, index] = path;
    if (top !== "methodCalls" || typeof index !== "number") return undefined;
    const invocation = methodCalls[index];
    return isInvocation(invocation) ? byId.get(invocation[2]) : undefined;
  }

  return writeJson(batch.body).map(({ text, tokens, path, closing }): AnnotatedLine => {
    const line: AnnotatedLine = { text, tokens };
    const call = callAt(path);
    if (call) {
      line.call = call.label;
      if (!closing) line.note = note(path, call);
    }
    return line;
  });
}
