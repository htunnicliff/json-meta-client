// oxlint-disable vitest/warn-todo -- Intentional integration coverage placeholders.
import { describe, it } from "vitest";

// Implement these through createClient() and the new standards contracts.
// Check server support explicitly before enabling optional extensions.

describe("RFC 8621 — Mailboxes", () => {
  it.todo("creates, gets, queries, updates, and destroys a mailbox");
  it.todo("tracks changes and query changes from a known state");
  it.todo("selects properties and reports missing IDs and invalid patches");
});

describe("RFC 8621 — Email and threads", () => {
  it.todo("creates and retrieves email with headers, addresses, body values, and attachments");
  it.todo("filters, sorts, and paginates email queries");
  it.todo("tracks email changes and query changes after keyword and mailbox updates");
  it.todo("retrieves threads and tracks thread changes");
  it.todo("imports and parses uploaded MIME blobs");
  it.todo("copies email between accounts and reports partial failures");
  it.todo("retrieves search snippets with matching body and subject text");
});

describe("RFC 8621 — Submission and vacation response", () => {
  it.todo("gets, updates, and tracks sending identities");
  it.todo("creates, gets, queries, and cancels submissions using a local delivery target");
  it.todo("tracks submission changes and query changes");
  it.todo("gets and updates vacation response settings");
});

describe("RFC 9007 — MDN (types pending)", () => {
  it.todo("sends a disposition notification and checks success and per-item errors");
});

describe("RFC 9219 — S/MIME (types pending)", () => {
  it.todo("reads S/MIME signature and encryption metadata from imported messages");
});

describe("RFC 9661 — Sieve (types pending)", () => {
  it.todo("creates, validates, activates, retrieves, queries, and destroys scripts");
  it.todo("tracks script changes and reports invalid scripts");
});
