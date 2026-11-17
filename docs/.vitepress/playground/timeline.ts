import type { RecordedKind, RecordedRequest } from "../recorder/index.ts";
import type { HookRun, HookUpdate } from "./protocol.ts";

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
  /**
   * A label that stays the same between runs: the call id when the playground
   * named it, such as `unread`, or else its place in send order, such as `#1`
   */
  label: string;
  name: string;
  callId: string;
  /** 0-based position in the run, in send order, to tell calls apart by color */
  order: number;
  /** The method calls this one refers to the results of, by label */
  refersTo: Record<string, { name: string; order: number }>;
  /** Labels of later method calls that refer to this one's result */
  referencedBy: string[];
  /**
   * Result reference arguments, such as `#ids`, by key → the label of the
   * method call referred to, or its call id when it is not in the timeline
   */
  references: Record<string, string>;
}

interface TimelineStep {
  key: string;
  target: Pick<TimelineEntry, "kind" | "method" | "url">;
  number?: number;
  request?: TimelineEntry;
  before: HookUpdate[];
  after: HookUpdate[];
}

/** Keep requests in send order and also show operations that have started a hook before fetch. */
export function buildTimelineSteps(
  requests: readonly (RecordedRequest | undefined)[],
  requestOperations: readonly (number | undefined)[],
  hookRuns: ReadonlyMap<number, HookRun>,
): TimelineStep[] {
  const pending = new Map(hookRuns);
  let batches = 0;
  const steps = buildTimeline(requests).map((request): TimelineStep => {
    const operation = requestOperations[request.index];
    const hooks = operation === undefined ? undefined : pending.get(operation);
    if (operation !== undefined) pending.delete(operation);
    const { before, after } = partitionHooks(hooks?.calls ?? []);
    return {
      key: operation === undefined ? request.key : `operation-${operation}`,
      target: request,
      number: request.kind === "batch" ? ++batches : undefined,
      request,
      before,
      after,
    };
  });
  for (const [operation, { target, calls }] of pending) {
    steps.push({
      key: `operation-${operation}`,
      target,
      number: target.kind === "batch" ? ++batches : undefined,
      ...partitionHooks(calls),
    });
  }
  return steps;
}

function partitionHooks(calls: readonly HookUpdate[]) {
  const before: HookUpdate[] = [];
  const after: HookUpdate[] = [];
  for (const call of calls) {
    (call.name.startsWith("before") ? before : after).push(call);
  }
  return { before, after };
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
 * Whether a call id reads as a name, such as `unread`, rather than the
 * library's default of method and random suffix, `Email/query::f3c9ebfd`
 */
function isNamedCallId(callId: string): boolean {
  return !callId.includes("::");
}

/**
 * How to refer to a method call in prose: its name, such as `unread`, or its
 * label and method, such as `#1 Email/query`
 */
export function describeCall({ label, name }: Pick<TimelineCall, "label" | "name">): string {
  return label.startsWith("#") ? `${label} ${name}` : label;
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
      const order = labels.size;
      const label = isNamedCallId(callId) ? callId : `#${order + 1}`;
      const refersTo: TimelineCall["refersTo"] = {};
      labels.set(callId, label);
      const references: Record<string, string> = {};
      for (const [key, value] of Object.entries(args)) {
        const target = key.startsWith("#") ? resultOf(value) : undefined;
        if (target === undefined) continue;
        references[key] = labels.get(target) ?? target;
        const referred = calls.get(target);
        if (referred) {
          referred.referencedBy.push(label);
          refersTo[referred.label] = { name: referred.name, order: referred.order };
        }
      }
      const call: TimelineCall = {
        label,
        name,
        callId,
        order,
        refersTo,
        referencedBy: [],
        references,
      };
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
 * A reference from one method call to the result of another, drawn as a line
 * from the call id of the call referred to down to the argument that refers
 */
export interface ResultLink {
  /** The method call referred to */
  from: { label: string; name?: string; order?: number };
  /** The method call that refers to it */
  to: { label: string; name: string; order: number };
  /** The argument that refers, such as `#ids` */
  key: string;
  /** The path into the result, such as `/ids` */
  path?: string;
}

/**
 * A line of a JMAP Request's JSON: the method call it belongs to, and where
 * result references start and end
 */
export interface AnnotatedLine extends JsonLine {
  /** The label of the method call this line is part of */
  call?: string;
  /** Whether this line holds its method call's id, which references point to */
  callId?: boolean;
  /** The result reference this line's argument makes */
  link?: ResultLink;
}

/**
 * The JMAP Request as `JSON.stringify(body, null, 2)` writes it, one line at a
 * time, with where its method calls and result references are
 */
export function annotateRequest(batch: BatchEntry): AnnotatedLine[] {
  const byId = new Map(batch.calls.map((call) => [call.callId, call]));
  const methodCalls: unknown[] =
    isObject(batch.body) && Array.isArray(batch.body.methodCalls) ? batch.body.methodCalls : [];

  function invocationAt(path: readonly (string | number)[]): Invocation | undefined {
    const [top, index] = path;
    if (top !== "methodCalls" || typeof index !== "number") return undefined;
    const invocation = methodCalls[index];
    return isInvocation(invocation) ? invocation : undefined;
  }

  return writeJson(batch.body).map(({ text, tokens, path, closing }): AnnotatedLine => {
    const line: AnnotatedLine = { text, tokens };
    const invocation = invocationAt(path);
    const call = invocation && byId.get(invocation[2]);
    if (!invocation || !call) return line;
    line.call = call.label;
    const [, , part, key] = path;
    if (part === 2 && path.length === 3) line.callId = true;
    const from = typeof key === "string" ? call.references[key] : undefined;
    if (part === 1 && path.length === 4 && typeof key === "string" && from && !closing) {
      const reference = invocation[1][key];
      line.link = {
        from: { label: from, ...call.refersTo[from] },
        to: { label: call.label, name: call.name, order: call.order },
        key,
        path:
          isObject(reference) && typeof reference.path === "string" ? reference.path : undefined,
      };
    }
    return line;
  });
}
