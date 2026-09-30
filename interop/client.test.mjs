import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { Client, JmapError, ref } from "json-meta-client";
import { mail } from "json-meta-client/capabilities";

const baseUrl = process.env.JMAP_INTEROP_URL;
const token = process.env.JMAP_INTEROP_TOKEN;
assert.ok(baseUrl && token, "Run through pnpm test:interop to provision the real server");
const client = new Client({
  bearerToken: token,
  sessionUrl: `${baseUrl}/.well-known/jmap`,
  capabilities: [mail],
});
const originalFetch = globalThis.fetch;
const requests = [];
let accountId;
let mailboxId;
let emailId;
const message =
  "From: sender@example.test\r\nTo: interop@example.test\r\nSubject: Interoperability fixture\r\nDate: Mon, 1 Jan 2024 00:00:00 +0000\r\nMessage-ID: <interop@example.test>\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nDeterministic body.\r\n";

void describe("Stalwart public API interoperability", { concurrency: false }, () => {
  before(async () => {
    globalThis.fetch = async (input, init) => {
      if (init?.body && typeof init.body === "string") {
        try {
          const body = JSON.parse(init.body);
          if (Array.isArray(body.methodCalls)) requests.push(body);
        } catch {}
      }
      return originalFetch(input, init);
    };
    const session = await client.session;
    accountId = session.primaryAccounts[mail.urn];
    assert.ok(accountId);
    const mailboxes = await client.api.Mailbox.set({
      create: { fixture: { name: "Interop fixture" } },
    });
    assert.ok(mailboxes.created?.fixture, JSON.stringify(mailboxes));
    mailboxId = mailboxes.created.fixture.id;
    const upload = await client.blob.upload(message);
    const imported = await client.api.Email.import({
      emails: {
        fixture: { blobId: upload.blobId, mailboxIds: { [mailboxId]: true }, keywords: {} },
      },
    });
    assert.ok(imported.created?.fixture, JSON.stringify(imported));
    emailId = imported.created.fixture.id;
  });

  after(async () => {
    try {
      if (emailId) {
        const result = await client.api.Email.set({ destroy: [emailId] });
        assert.deepEqual(result.destroyed, [emailId]);
      }
      if (mailboxId) {
        const result = await client.api.Mailbox.set({ destroy: [mailboxId] });
        assert.deepEqual(result.destroyed, [mailboxId]);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  void it("discovers authenticated session and refreshes it", async () => {
    const session = await client.refreshSession();
    assert.ok(session.capabilities[mail.urn]);
    assert.ok(session.capabilities["urn:ietf:params:jmap:core"]);
    assert.equal(session.primaryAccounts[mail.urn], accountId);
    assert.equal(new URL(session.apiUrl).origin, baseUrl);
    assert.ok(session.uploadUrl.includes("{accountId}"));
    assert.ok(session.downloadUrl.includes("{blobId}"));
  });

  void it("executes Core Blob/copy", async () => {
    const upload = await client.blob.upload("Core copy fixture");
    const copied = await client.api.Blob.copy({
      fromAccountId: accountId,
      accountId,
      blobIds: [upload.blobId],
    });
    assert.equal(copied.copied[upload.blobId], upload.blobId);
  });

  void it("queries deterministic mail and fetches selected properties", async () => {
    const query = await client.api.Email.query({ filter: { inMailbox: mailboxId }, limit: 10 });
    assert.equal(query.accountId, accountId);
    assert.deepEqual(query.ids, [emailId]);
    const emails = await client.api.Email.get({
      ids: query.ids,
      properties: ["id", "subject", "mailboxIds"],
    });
    assert.deepEqual(emails.notFound, []);
    assert.equal(emails.list[0].subject, "Interoperability fixture");
    assert.deepEqual(Object.keys(emails.list[0]).toSorted(), ["id", "mailboxIds", "subject"]);
  });

  void it("batches simultaneous calls into one actual HTTP request", async () => {
    requests.length = 0;
    const [query, mailboxes] = await Promise.all([
      client.api.Email.query({ filter: { inMailbox: mailboxId } }),
      client.api.Mailbox.get({ ids: [mailboxId], properties: ["id", "name"] }),
    ]);
    assert.deepEqual(query.ids, [emailId]);
    assert.equal(mailboxes.list[0].id, mailboxId);
    assert.equal(requests.length, 1);
    assert.deepEqual(
      requests[0].methodCalls.map(([name]) => name),
      ["Email/query", "Mailbox/get"],
    );
  });

  void it("resolves ref() dependencies in the same real request", async () => {
    requests.length = 0;
    const query = client.api.Email.query({ filter: { inMailbox: mailboxId } });
    const emails = await client.api.Email.get({
      ids: ref(query, "/ids"),
      properties: ["id", "subject"],
    });
    assert.equal(emails.list[0].id, emailId);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].methodCalls.length, 2);
    assert.equal(requests[0].methodCalls[1][1]["#ids"].name, "Email/query");
  });

  void it("uploads and downloads exact blob bytes", async () => {
    const bytes = new TextEncoder().encode("Interop blob: café\n");
    const uploaded = await client.blob.upload(bytes);
    assert.equal(uploaded.accountId, accountId);
    assert.equal(uploaded.size, bytes.byteLength);
    const downloaded = await client.blob.download({
      blobId: uploaded.blobId,
      name: "fixture.txt",
      type: "text/plain",
    });
    assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()), bytes);
  });

  void it("exposes a real method error and remains usable", async () => {
    await assert.rejects(
      client.api.Email.query({ sort: [{ property: "unsupported-property" }] }),
      (error) => {
        assert.ok(error instanceof JmapError);
        assert.equal(error.type, "unsupportedSort");
        return true;
      },
    );
    assert.deepEqual((await client.api.Email.query({ filter: { inMailbox: mailboxId } })).ids, [
      emailId,
    ]);
  });

  void it("rejects invalid bearer authentication with the server HTTP status", async () => {
    const unauthorized = new Client({
      bearerToken: "invalid-interop-token",
      sessionUrl: `${baseUrl}/.well-known/jmap`,
      capabilities: [mail],
    });
    await assert.rejects(unauthorized.session, /JMAP request failed \(401\)/);
  });
});
