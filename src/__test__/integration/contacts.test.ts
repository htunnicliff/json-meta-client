// oxlint-disable vitest/warn-todo -- Intentional integration coverage placeholders.
import { describe, it } from "vitest";

// Implement these through createClient() and the new standards contracts.
// Check server support explicitly before enabling optional extensions.

describe("RFC 9610 — Contacts", () => {
  it.todo("creates, gets, queries, updates, and destroys address books and contact cards");
  it.todo("tracks contact changes and query changes with a saved state");
  it.todo("checks contact sharing rights and denied updates");
});

describe("RFC 9553 — JSContact", () => {
  it.todo("round-trips names, addresses, anniversaries, and extension fields in contact cards");
});
