// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

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
