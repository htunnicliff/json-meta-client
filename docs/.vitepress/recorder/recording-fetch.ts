import type { Session } from "../../../src/rfc-types/core/index.ts";
import { placeholderSession } from "./placeholder-session.ts";

/**
 * What a recorded request was for
 */
export type RecordedKind =
  | "session"
  | "request"
  | "upload"
  | "download"
  | "eventSource"
  | "unknown";

export interface RecordedRequest {
  kind: RecordedKind;
  method: string;
  url: string;
  /**
   * The parsed JSON body of a JMAP Request, or the text body of any other
   * request that has one
   */
  body?: unknown;
}

export interface Recorder {
  /**
   * A `fetch` replacement. It answers Session fetches with a placeholder
   * Session, records every request, and leaves every request other than a
   * Session fetch pending forever. It never rejects.
   */
  fetch: typeof fetch;
  /**
   * How many requests `fetch` has received so far, including those whose
   * bodies are still being read
   */
  readonly count: number;
  /**
   * Every recorded request, in the order received, once their bodies are read
   */
  settled(): Promise<RecordedRequest[]>;
}

/**
 * A response to a recorded request, in pass-through mode
 */
export interface RecordedResponse {
  /** The HTTP status, or 0 when the request failed */
  status: number;
  /**
   * The parsed JSON body, or the text body of other responses, cut short past
   * {@link MAX_RESPONSE_BYTES}. Event streams are not read.
   */
  body?: unknown;
  /** Why the request failed, when it did */
  error?: string;
}

/** The most of a response body that is recorded */
export const MAX_RESPONSE_BYTES = 100_000;

export interface RecorderOptions {
  /**
   * Capability URNs to add to each placeholder Session, read at each Session
   * fetch, such as those of custom capabilities a client was configured with
   */
  extraUrns?: () => readonly string[];
  /**
   * Called with each recorded request once its body is read, and its index in
   * the order received. Requests whose bodies take longer may arrive out of
   * order.
   */
  onRecord?: (request: RecordedRequest, index: number) => void;
  /**
   * Send each request with this `fetch` and record its response, instead of
   * answering Session fetches with a placeholder and leaving every other
   * request pending
   */
  passThrough?: typeof fetch;
  /**
   * Called with the response to each request: every response in pass-through
   * mode, and otherwise each placeholder Session, after its request is
   * recorded
   */
  onResponse?: (response: RecordedResponse, index: number) => void;
}

/**
 * Create a {@link Recorder}
 */
export function recordingFetch({
  extraUrns,
  onRecord,
  passThrough,
  onResponse,
}: RecorderOptions = {}): Recorder {
  const entries: Promise<RecordedRequest>[] = [];
  // Sessions handed out or passed through, so their other URLs are recognized
  const sessions: Session[] = [];

  function classify(method: string, url: string): RecordedKind {
    const matches = (template: (session: Session) => string) =>
      sessions.some((session) => url.startsWith(templatePrefix(template(session))));
    if (method === "GET") {
      if (matches((session) => session.downloadUrl)) return "download";
      if (matches((session) => session.eventSourceUrl)) return "eventSource";
      return "session";
    }
    if (method === "POST") {
      if (sessions.some((session) => url === session.apiUrl)) return "request";
      if (matches((session) => session.uploadUrl)) return "upload";
    }
    return "unknown";
  }

  async function record(request: Request, kind: RecordedKind): Promise<RecordedRequest> {
    const entry: RecordedRequest = { kind, method: request.method, url: request.url };
    try {
      const text = await request.text();
      if (text) entry.body = kind === "request" ? JSON.parse(text) : text;
    } catch {
      // A body that cannot be read or parsed is recorded without it
    }
    return entry;
  }

  function push(entry: Promise<RecordedRequest>): number {
    const index = entries.length;
    entries.push(entry);
    if (onRecord) void entry.then((request) => onRecord(request, index));
    return index;
  }

  async function recordResponse(response: Response, kind: RecordedKind, index: number) {
    const recorded: RecordedResponse = { status: response.status };
    if (kind !== "eventSource") {
      const text = await readCapped(response.clone(), MAX_RESPONSE_BYTES);
      if (text) recorded.body = parseJson(text) ?? text;
    }
    if (kind === "session" && isSession(recorded.body)) sessions.push(recorded.body);
    onResponse?.(recorded, index);
  }

  function send(request: Request, kind: RecordedKind, fetch: typeof globalThis.fetch) {
    const index = push(record(request.clone(), kind));
    return fetch(request).then(
      async (response) => {
        const recording = recordResponse(response, kind, index);
        // A Session must be known before the client's next request is classified
        if (kind === "session") await recording;
        return response;
      },
      (error: unknown) => {
        onResponse?.({ status: 0, error: String(error) }, index);
        throw error;
      },
    );
  }

  const recordingFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let request: Request;
    try {
      request = new Request(input, init);
    } catch {
      push(
        Promise.resolve({
          kind: "unknown",
          method: "GET",
          url: input instanceof Request ? input.url : input.toString(),
        }),
      );
      return new Promise(() => {});
    }
    const kind = classify(request.method, request.url);
    if (passThrough) return send(request, kind, passThrough);
    const index = push(record(request, kind));
    if (kind !== "session") return new Promise(() => {});
    const session = placeholderSession(new URL(request.url).origin, extraUrns?.());
    sessions.push(session);
    if (onResponse) {
      void entries[index].then(() => onResponse({ status: 200, body: session }, index));
    }
    return Promise.resolve(Response.json(session));
  };

  return {
    fetch: recordingFetch,
    get count() {
      return entries.length;
    },
    settled: () => Promise.all(entries),
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isSession(value: unknown): value is Session {
  return (
    typeof value === "object" &&
    value !== null &&
    "apiUrl" in value &&
    typeof value.apiUrl === "string"
  );
}

/**
 * A response's text, cut short past `limit` bytes
 */
async function readCapped(response: Response, limit: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "";
  let total = 0;
  try {
    for (;;) {
      // oxlint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      total += value.byteLength;
      text += decoder.decode(value, { stream: true });
      if (total > limit) {
        void reader.cancel();
        return `${text.slice(0, limit)}…`;
      }
    }
  } catch {
    return text;
  }
}

/**
 * The part of a URI template before its first expression
 */
function templatePrefix(template: string): string {
  const index = template.indexOf("{");
  return index === -1 ? template : template.slice(0, index);
}
