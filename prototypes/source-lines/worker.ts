// PROTOTYPE (#201): module Web Worker. Transforms and runs user code against
// the real library with a fake fetch whose JMAP POST never resolves.
import { JsonMetaClient } from "../../src/index.ts";
import { createRuntime } from "./runtime.ts";
import { instrument, plainTranspile } from "./transform.ts";

const origin = "https://example.test";
const accountId = "<account-id>";
const session = {
  accounts: {
    [accountId]: { name: "Primary", isPersonal: true, isReadOnly: false, accountCapabilities: {} },
  },
  apiUrl: `${origin}/jmap/api`,
  downloadUrl: `${origin}/jmap/download/{accountId}/{blobId}?type={type}&name={name}`,
  uploadUrl: `${origin}/jmap/upload/{accountId}`,
  eventSourceUrl: `${origin}/jmap/events?types={types}&closeafter={closeafter}&ping={ping}`,
  state: "<state>",
  username: "<user>",
  primaryAccounts: {
    "urn:ietf:params:jmap:mail": accountId,
    "urn:ietf:params:jmap:submission": accountId,
  },
  capabilities: {
    "urn:ietf:params:jmap:core": {
      maxSizeUpload: 1,
      maxConcurrentUpload: 1,
      maxSizeRequest: 1e7,
      maxConcurrentRequests: 4,
      maxCallsInRequest: 16,
      maxObjectsInGet: 256,
      maxObjectsInSet: 128,
      collationAlgorithms: [],
    },
    "urn:ietf:params:jmap:mail": {},
    "urn:ietf:params:jmap:submission": {},
  },
};

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
  ...a: string[]
) => (...a: unknown[]) => Promise<unknown>;

async function run(source: string) {
  plainTranspile(source); // warm up the compiler so the timings compare fairly
  instrument(source);
  const N = 10;
  const t0 = performance.now();
  for (let i = 0; i < N; i++) plainTranspile(source);
  const t1 = performance.now();
  for (let i = 0; i < N; i++) instrument(source);
  const t2 = performance.now();
  const inst = instrument(source);
  const rt = createRuntime(inst);

  const requestIds: string[] = [];
  let sawPost: () => void;
  const posted = new Promise<void>((r) => (sawPost = r));
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    if (req.method === "GET") {
      return new Response(JSON.stringify(session), {
        headers: { "content-type": "application/json" },
      });
    }
    const body = (await req.json()) as { methodCalls: [string, unknown, string][] };
    for (const [, , id] of body.methodCalls) requestIds.push(id);
    sawPost();
    return new Promise<Response>(() => {}); // never settles: execution stops here
  }) as typeof fetch;

  const client = new JsonMetaClient({
    auth: "<token>",
    sessionUrl: `${origin}/.well-known/jmap`,
    capabilities: ["mail", "submission"],
  });

  let finished = false;
  let error: string | undefined;
  const fn = new AsyncFunction("__pg", "client", inst.code);
  fn(rt.pg, client).then(
    () => (finished = true),
    (e) => ((finished = true), (error = String(e))),
  );
  await Promise.race([posted, new Promise((r) => setTimeout(r, 1500))]);
  await new Promise((r) => setTimeout(r, 50));
  return {
    finished,
    error,
    timing: { plainMs: (t1 - t0) / N, instrumentedMs: (t2 - t1) / N },
    requestIds,
    report: rt.report(requestIds),
  };
}

self.onmessage = async (e: MessageEvent<{ source: string }>) => {
  try {
    self.postMessage({ ok: true, result: await run(e.data.source) });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err), stack: (err as Error)?.stack });
  }
};
self.postMessage({ ready: true });
