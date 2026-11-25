import { describe, expect, it } from "vitest";

import { createClient } from "./client.ts";

describe("blobs", () => {
  it("uploads a blob and downloads it through the session's URL templates", async () => {
    const client = createClient("mail");
    const session = await client.session;
    const accountId = session.primaryAccounts["urn:ietf:params:jmap:mail"]!;
    const content = "A blob for the round trip";

    const upload = await client.blob.upload(new Blob([content], { type: "text/plain" }), {
      accountId,
    });

    expect(upload).toMatchObject({
      accountId,
      type: "text/plain",
      size: new TextEncoder().encode(content).byteLength,
    });

    const download = await client.blob.download({
      accountId,
      blobId: upload.blobId,
      name: "round trip.txt",
      type: "text/plain",
    });

    expect(download.status).toBe(200);
    expect(download.headers.get("content-type")).toMatch(/^text\/plain\b/);
    await expect(download.text()).resolves.toBe(content);
  });
});
