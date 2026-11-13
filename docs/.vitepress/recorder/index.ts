// Records the HTTP requests a documentation example makes, without a server.
// It must not import Node-only or VitePress modules, so a Web Worker can
// bundle it for the playground.
import { BUILT_IN_CAPABILITIES } from "../../../src/built-ins.ts";
import { core } from "../../../src/capabilities/core.ts";
import type { Session } from "../../../src/rfc-types/core/index.ts";

/**
 * The id of the only account in a placeholder Session, primary for every
 * capability.
 */
export const PLACEHOLDER_ACCOUNT_ID = "<account-id>";

/**
 * A Session for a server at `origin` that supports every built-in capability,
 * plus any `extraUrns`, with {@link PLACEHOLDER_ACCOUNT_ID} as each primary
 * account.
 */
export function placeholderSession(origin: string, extraUrns: readonly string[] = []): Session {
  const urns = [...Object.values(BUILT_IN_CAPABILITIES).map(({ urn }) => urn), ...extraUrns];
  const capabilities: Session["capabilities"] = {
    ...Object.fromEntries(urns.map((urn) => [urn, {}])),
    [core.urn]: {
      maxSizeUpload: 50_000_000,
      maxConcurrentUpload: 4,
      maxSizeRequest: 10_000_000,
      maxConcurrentRequests: 4,
      maxCallsInRequest: 16,
      maxObjectsInGet: 256,
      maxObjectsInSet: 128,
      collationAlgorithms: [],
    },
  };
  return {
    capabilities,
    accounts: {
      [PLACEHOLDER_ACCOUNT_ID]: {
        name: "Placeholder",
        isPersonal: true,
        isReadOnly: false,
        accountCapabilities: Object.fromEntries(urns.map((urn) => [urn, {}])),
      },
    },
    primaryAccounts: Object.fromEntries(urns.map((urn) => [urn, PLACEHOLDER_ACCOUNT_ID])),
    username: "<username>",
    apiUrl: `${origin}/jmap/api`,
    downloadUrl: `${origin}/jmap/download/{accountId}/{blobId}/{name}?type={type}`,
    uploadUrl: `${origin}/jmap/upload/{accountId}`,
    eventSourceUrl: `${origin}/jmap/eventsource/?types={types}&closeafter={closeafter}&ping={ping}`,
    state: "<session-state>",
  };
}

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
 * Create a {@link Recorder}
 */
export function recordingFetch(): Recorder {
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

  const recordingFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let request: Request;
    try {
      request = new Request(input, init);
    } catch {
      entries.push(
        Promise.resolve({
          kind: "unknown",
          method: "GET",
          url: input instanceof Request ? input.url : input.toString(),
        }),
      );
      return new Promise(() => {});
    }
    const kind = classify(request.method, request.url);
    entries.push(record(request, kind));
    if (kind !== "session") return new Promise(() => {});
    const session = placeholderSession(new URL(request.url).origin);
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

/**
 * Replace `crypto.getRandomValues`, which the client draws call ids from, with
 * a generator seeded by `seed`, so the same method calls get the same ids on
 * every run. Returns a function that restores the original.
 */
export function seedCallIds(seed: number): () => void {
  const original = Object.getOwnPropertyDescriptor(crypto, "getRandomValues");
  const next = mulberry32(seed);
  Object.defineProperty(crypto, "getRandomValues", {
    configurable: true,
    writable: true,
    value: <T extends ArrayBufferView | null>(array: T): T => {
      if (array) {
        const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        for (let index = 0; index < bytes.length; index++) bytes[index] = next() & 0xff;
      }
      return array;
    },
  });
  return () => {
    if (original) Object.defineProperty(crypto, "getRandomValues", original);
    else delete (crypto as { getRandomValues?: unknown }).getRandomValues;
  };
}

/**
 * A small seeded generator of 32-bit unsigned integers
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}
