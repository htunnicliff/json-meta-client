import { PLACEHOLDER_ACCOUNT_ID } from "../recorder/index.ts";
import type { RecordedKind, RecordedRequest } from "../recorder/index.ts";

/**
 * Where a run is: still running, possibly stuck in a loop, waiting at a pending
 * `await`, finished, or stopped by an error
 */
export type RunStatus = "running" | "stuck" | "waiting" | "finished" | "failed";

/**
 * The timeline the request panel shows, built from the recorded requests of a
 * run in send order
 */
export type TimelineEntry = SessionEntry | BatchEntry | OtherEntry;

interface BaseEntry {
  /** Stable across runs that make the same requests, for keyed rendering */
  key: string;
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
  using: string[];
  calls: TimelineCall[];
  /** How many result references the Batch's method calls hold */
  references: number;
  /** The JMAP Request exactly as sent */
  body: unknown;
}

export interface TimelineCall {
  /** A label that stays the same between runs, such as `#1`, in send order */
  label: string;
  name: string;
  callId: string;
  args: TimelineArg[];
  /** Labels of later method calls that refer to this one's result */
  referencedBy: string[];
}

export interface TimelineArg {
  key: string;
  value: unknown;
  /** Set when the client filled the value in from the Session */
  fromSession?: boolean;
  /** Set for a result reference argument, such as `#ids` */
  reference?: ResultReference;
}

export interface ResultReference {
  name: string;
  path: string;
  resultOf: string;
  /** The label of the method call referred to, when it is in the timeline */
  label?: string;
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

function asReference(value: unknown): Omit<ResultReference, "label"> | undefined {
  if (!isObject(value)) return undefined;
  const { name, path, resultOf } = value;
  if (typeof name !== "string" || typeof path !== "string" || typeof resultOf !== "string") {
    return undefined;
  }
  return { name, path, resultOf };
}

/**
 * Build the timeline of recorded requests, given in send order
 */
export function buildTimeline(requests: readonly RecordedRequest[]): TimelineEntry[] {
  const labels = new Map<string, string>();
  const calls = new Map<string, TimelineCall>();
  let batches = 0;
  let others = 0;
  return requests.map((request, index): TimelineEntry => {
    const base = { method: request.method, url: request.url };
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
    const using = Array.isArray(body.using)
      ? body.using.filter((urn) => typeof urn === "string")
      : [];
    const invocations = Array.isArray(body.methodCalls)
      ? body.methodCalls.filter(isInvocation)
      : [];
    let references = 0;
    const batchCalls = invocations.map(([name, args, callId]): TimelineCall => {
      const label = `#${labels.size + 1}`;
      labels.set(callId, label);
      const call: TimelineCall = {
        label,
        name,
        callId,
        referencedBy: [],
        args: Object.entries(args).map(([key, value]): TimelineArg => {
          const reference = key.startsWith("#") ? asReference(value) : undefined;
          if (reference) {
            references++;
            const target = labels.get(reference.resultOf);
            calls.get(reference.resultOf)?.referencedBy.push(label);
            return { key, value, reference: { ...reference, label: target } };
          }
          if (key === "accountId" && value === PLACEHOLDER_ACCOUNT_ID) {
            return { key, value, fromSession: true };
          }
          return { key, value };
        }),
      };
      calls.set(callId, call);
      return call;
    });
    return {
      ...base,
      kind: "batch",
      key: `batch-${number}`,
      number,
      using,
      calls: batchCalls,
      references,
      body: request.body,
    };
  });
}

const identifier = /^[A-Za-z_$][\w$]*$/;

/**
 * A short, one-line form of a JSON value, as in `{ notKeyword: "$seen" }`
 */
export function compactJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(compactJson).join(", ")}]`;
  if (isObject(value)) {
    const entries = Object.entries(value);
    if (!entries.length) return "{}";
    const fields = entries.map(
      ([key, field]) =>
        `${identifier.test(key) ? key : JSON.stringify(key)}: ${compactJson(field)}`,
    );
    return `{ ${fields.join(", ")} }`;
  }
  return JSON.stringify(value) ?? String(value);
}

export type NoteTone = "session" | "config" | "reference" | "label";

/**
 * A line of a JMAP Request's JSON, with a note saying where its value came
 * from
 */
export interface AnnotatedLine {
  text: string;
  note?: { text: string; tone: NoteTone };
}

const CORE_URN = "urn:ietf:params:jmap:core";

/**
 * The JMAP Request as `JSON.stringify(body, null, 2)` writes it, one line at a
 * time, with notes on the values that came from the Session, the client's
 * configuration, or result references
 */
export function annotateRequest(batch: BatchEntry): AnnotatedLine[] {
  const byId = new Map(batch.calls.map((call) => [call.callId, call]));
  const methodCalls: unknown[] =
    isObject(batch.body) && Array.isArray(batch.body.methodCalls) ? batch.body.methodCalls : [];
  const lines: AnnotatedLine[] = [];

  function note(path: readonly (string | number)[], value: unknown): AnnotatedLine["note"] {
    const [top, index, part, key] = path;
    if (top === "using" && path.length === 2) {
      return value === CORE_URN
        ? { text: "always sent", tone: "config" }
        : { text: "from the client's capabilities", tone: "config" };
    }
    if (top !== "methodCalls" || typeof index !== "number") return undefined;
    const invocation = methodCalls[index];
    const call = isInvocation(invocation) ? byId.get(invocation[2]) : undefined;
    if (!call) return undefined;
    if (path.length === 2) return { text: `${call.label} ${call.name}`, tone: "label" };
    if (part === 2 && path.length === 3 && call.referencedBy.length) {
      return { text: `referenced by ${call.referencedBy.join(", ")}`, tone: "reference" };
    }
    if (part !== 1 || path.length !== 4 || typeof key !== "string") return undefined;
    const arg = call.args.find((candidate) => candidate.key === key);
    if (arg?.fromSession) return { text: "from session.primaryAccounts", tone: "session" };
    if (arg?.reference) {
      const target = arg.reference.label ?? arg.reference.resultOf;
      return { text: `result of ${target}`, tone: "reference" };
    }
    return undefined;
  }

  function write(
    value: unknown,
    path: (string | number)[],
    depth: number,
    prefix: string,
    suffix: string,
  ) {
    const pad = "  ".repeat(depth);
    const push = (text: string, withNote: boolean) =>
      lines.push(withNote ? { text, note: note(path, value) } : { text });
    const entries: [string | number, unknown][] | undefined = Array.isArray(value)
      ? value.map((item, index) => [index, item])
      : isObject(value)
        ? Object.entries(value)
        : undefined;
    if (!entries) {
      push(`${pad}${prefix}${JSON.stringify(value)}${suffix}`, true);
      return;
    }
    const [open, close] = Array.isArray(value) ? ["[", "]"] : ["{", "}"];
    if (!entries.length) {
      push(`${pad}${prefix}${open}${close}${suffix}`, true);
      return;
    }
    push(`${pad}${prefix}${open}`, true);
    entries.forEach(([key, item], index) => {
      const itemPrefix = typeof key === "string" ? `${JSON.stringify(key)}: ` : "";
      const itemSuffix = index < entries.length - 1 ? "," : "";
      write(item, [...path, key], depth + 1, itemPrefix, itemSuffix);
    });
    push(`${pad}${close}${suffix}`, false);
  }

  write(batch.body, [], 0, "", "");
  return lines;
}
