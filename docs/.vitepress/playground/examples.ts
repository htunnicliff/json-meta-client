import homeRequest from "../../snippets/home-request.md?raw";

/**
 * The first TypeScript fence of a Markdown page
 */
export function firstTypeScriptFence(markdown: string): string {
  const match = /^```(?:ts|typescript)\b[^\n]*\n([\s\S]*?)^```/m.exec(markdown);
  if (!match?.[1]) throw new Error("No TypeScript fence found");
  return match[1];
}

/**
 * The home page example, read from its snippet so the two cannot drift apart
 */
export const defaultExample: string = firstTypeScriptFence(homeRequest);

export interface Example {
  id: string;
  title: string;
  code: string;
}

const sequentialAwaits = `import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "<server>",
  auth: "<credentials>",
  capabilities: ["mail"],
});

const unread = await client.api.Email.query({
  filter: { notKeyword: "$seen" },
  limit: 5,
});

const emails = await client.api.Email.get({
  ids: unread.ids,
  properties: ["subject", "from"],
});

for (const { subject, from } of emails.list) {
  console.log(subject, from);
}
`;

const eventSource = `import { JsonMetaClient } from "json-meta-client";

// Running against a connected server marks one unread message as read.
const { promise: connected, resolve: streamReady } = Promise.withResolvers<void>();

const client = new JsonMetaClient({
  sessionUrl: "<server>",
  auth: "<credentials>",
  capabilities: ["mail"],
  hooks: { afterEventSourceConnect: [() => streamReady()] },
});

const controller = new AbortController();
await client.onStateChange(
  (error, change) => {
    if (error) {
      console.error(error);
    } else if (change.entity === "Email" && change.isPrimaryAccount) {
      console.log("Email state change received:", change.state);
    }
  },
  { signal: controller.signal },
);

// Allow up to one minute for the connection and its notifications.
const timeout = setTimeout(stopListening, 60_000);

function stopListening() {
  clearTimeout(timeout);
  controller.abort();
  streamReady(); // Release the wait if the stream never connected.
}

try {
  const { ids: [id] } = await client.api.Email.query({
    filter: { notKeyword: "$seen" },
    limit: 1,
  });

  if (id === undefined) {
    console.log("No unread messages found.");
    stopListening();
  } else {
    // Wait for the stream before marking a message as read on the server.
    await connected;
    controller.signal.throwIfAborted();
    const { newState, notUpdated } = await client.api.Email.set({
      update: { [id]: { "keywords/$seen": true } },
    });
    const failure = notUpdated?.[id];
    if (failure) {
      throw new Error(\`Could not mark message as read: \${failure.type}\`);
    }
    console.log("Marked message as read. New Email state:", newState);
  }
} catch (error) {
  stopListening();
  throw error;
}
`;

const rewriteEmailQuery = `import { JsonMetaClient } from "json-meta-client";
import type { BeforeJmapRequestHook } from "json-meta-client";

const setEmailQueryLimit: BeforeJmapRequestHook = ({ jmapRequest }) => {
  for (const [method, args] of jmapRequest.methodCalls) {
    if (method === "Email/query") {
      Object.assign(args, { limit: 5 });
    }
  }
  return jmapRequest;
};

const client = new JsonMetaClient({
  sessionUrl: "<server>",
  auth: "<credentials>",
  capabilities: ["mail"],
  hooks: {
    beforeJmapRequest: [setEmailQueryLimit],
  },
});

// The outgoing batch shows the limit set by the hook.
const { ids } = await client.api.Email.query({ limit: 25 });
console.log(ids);
`;

const logHttpTraffic = `import { JsonMetaClient } from "json-meta-client";
import type { AfterFetchHook, BeforeFetchHook } from "json-meta-client";

const logRequest: BeforeFetchHook = ({ httpRequest }) => {
  console.log(httpRequest.method, new URL(httpRequest.url).pathname);
  return httpRequest;
};

const logResponse: AfterFetchHook = ({ httpRequest, httpResponse }) => {
  console.log(httpResponse.status, new URL(httpRequest.url).pathname);
  return httpResponse;
};

const client = new JsonMetaClient({
  sessionUrl: "<server>",
  auth: "<credentials>",
  capabilities: ["mail"],
  hooks: {
    beforeFetch: [logRequest],
    afterFetch: [logResponse],
  },
});

const { list } = await client.api.Mailbox.get({ properties: ["name"] });
console.log(list.map(({ name }) => name));
`;

/**
 * The examples the playground offers, the first being its default
 */
const header = `import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "<server>",
  auth: "<credentials>",
  capabilities: ["mail"],
});
`;

// A chain of result references: each call takes its input from the one before
const followThread = `${header}
// These calls go out in one request, each taking its input
// from the result of the one before. Hover a dotted line in
// the request to see what it passes along.
const latest = client.api.Email.query({
  sort: [{ property: "receivedAt", isAscending: false }],
  limit: 1,
});

const latestEmail = client.api.Email.get({
  ids: latest.resultRef("/ids"),
  properties: ["threadId"],
});

const thread = await client.api.Thread.get({
  ids: latestEmail.resultRef("/list/*/threadId"),
});

console.log(thread.list[0]!.emailIds);
`;

// One result feeding two calls
const searchSnippets = `${header}
// One query feeds two calls in the same request: the emails
// it matched, and a highlighted snippet of each match.
const filter = { text: "invoice" };

const matches = client.api.Email.query({ filter, limit: 10 });

const [emails, snippets] = await Promise.all([
  client.api.Email.get({
    ids: matches.resultRef("/ids"),
    properties: ["subject", "from"],
  }),
  client.api.SearchSnippet.get({
    filter,
    emailIds: matches.resultRef("/ids"),
  }),
]);

console.log(emails.list, snippets.list);
`;

export const examples: readonly Example[] = [
  { id: "unread-subjects", title: "Unread subjects", code: defaultExample },
  { id: "sequential-awaits", title: "Sequential awaits", code: sequentialAwaits },
  { id: "event-source", title: "Event source", code: eventSource },
  { id: "rewrite-email-query", title: "Rewrite an email query", code: rewriteEmailQuery },
  { id: "log-http-traffic", title: "Log HTTP traffic", code: logHttpTraffic },
  { id: "follow-a-thread", title: "Follow a thread", code: followThread },
  { id: "search-snippets", title: "Search with snippets", code: searchSnippets },
];

const withoutWhitespace = (text: string) => text.replaceAll(/\s+/g, "");

/**
 * The built-in example whose code this is, if any, ignoring whitespace
 */
export function findExample(code: string): Example | undefined {
  const normalized = withoutWhitespace(code);
  return examples.find((example) => withoutWhitespace(example.code) === normalized);
}
