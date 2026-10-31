// oxlint-disable vitest/warn-todo -- Intentional integration coverage placeholders.
import { describe, it } from "vitest";

// Implement these through createClient() and the new standards contracts.
// Check server support explicitly before enabling optional extensions.

describe("RFC 8620 — JMAP core", () => {
  it.todo("discovers session and account capabilities with the configured client types");
  it.todo("round-trips Core/echo arguments through a capability defined with CoreEcho.Contract");
  it.todo("uploads and downloads binary data without changing bytes or content type");
  it.todo("copies a blob between accounts and reports inaccessible source blobs");
  it.todo("resolves creation IDs and result references across batched method calls");
  it.todo("reports method errors, set errors, and request-level problem details");
  it.todo("receives state changes through the client event subscription");
  it.todo("creates, retrieves, updates, and destroys push subscriptions");
});

describe("RFC 8887 — WebSocket", () => {
  it.todo("uses the advertised WebSocket URL and negotiates supported transports");
  it.todo("round-trips request IDs and push state changes over WebSocket");
});

describe("RFC 9404 — Blob management", () => {
  it.todo("round-trips Blob/upload, Blob/get, and Blob/lookup using the new contracts");
  it.todo("handles byte ranges, encodings, missing blobs, and per-item errors");
});

describe("RFC 9425 — Quotas", () => {
  it.todo("retrieves and queries typed quotas, resource limits, and scopes");
  it.todo("reports changes from a previously retrieved quota state");
});

describe("RFC 9670 — Sharing", () => {
  it.todo("retrieves, queries, and tracks changes to principals");
  it.todo("updates principal properties and reports permission errors");
  it.todo("retrieves, queries, updates, and tracks share notifications");
  it.todo("exposes account owner, current principal, and sharing rights");
});

describe("RFC 9749 — VAPID", () => {
  it.todo("reads the advertised application server key through client.session");
});
