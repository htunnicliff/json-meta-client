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
}

/**
 * Create a {@link Recorder}
 */
export function recordingFetch({ extraUrns, onRecord }: RecorderOptions = {}): Recorder {
  const entries: Promise<RecordedRequest>[] = [];
  // Placeholder Sessions handed out, so their other URLs are recognized
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

  function push(entry: Promise<RecordedRequest>) {
    const index = entries.length;
    entries.push(entry);
    if (onRecord) void entry.then((request) => onRecord(request, index));
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
    push(record(request, kind));
    if (kind !== "session") return new Promise(() => {});
    const session = placeholderSession(new URL(request.url).origin, extraUrns?.());
    sessions.push(session);
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

/**
 * The part of a URI template before its first expression
 */
function templatePrefix(template: string): string {
  const index = template.indexOf("{");
  return index === -1 ? template : template.slice(0, index);
}
