/**
 * Copyright (c) 2026 Hunter Tunnicliff
 *
 * This source code is subject to the terms of the Mozilla Public
 * License, version 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { assertType, describe, it } from "vitest";

import type { BlobGet, DataSourceObject } from "../core/rfc9404-blobs.ts";
import type { QuotaChanges, QuotaFilter } from "../core/rfc9425-quotas.ts";
import type {
  PrincipalCapabilities,
  PrincipalFilter,
  PrincipalSet,
  ShareNotificationFilter,
  ShareNotificationSet,
} from "../core/rfc9670-sharing.ts";

describe("RFC extension types", () => {
  it("accepts nullable blob source fields and standard get arguments", () => {
    assertType<DataSourceObject>({ blobId: "blob", offset: null, length: null });
    assertType<DataSourceObject>({ "data:asText": null });
    assertType<DataSourceObject>({ "data:asBase64": null });
    assertType<BlobGet.Input>({ accountId: "account" });
    assertType<BlobGet.Input>({ accountId: "account", ids: null });
  });

  it("requires exactly one blob source", () => {
    // @ts-expect-error RFC 9404 section 4.1 allows exactly one source.
    assertType<DataSourceObject>({ "data:asText": "text", "data:asBase64": "dGV4dA==" });
    // @ts-expect-error Inline data and blob references cannot be combined.
    assertType<DataSourceObject>({ "data:asText": "text", blobId: "blob" });
    // @ts-expect-error Range arguments only apply to a blobId source.
    assertType<DataSourceObject>({ "data:asText": "text", offset: 1 });
  });

  it("accepts omitted filter conditions and string quota resource filters", () => {
    assertType<QuotaFilter>({});
    assertType<QuotaFilter>({ resourceType: "unknown-resource" });
    assertType<PrincipalFilter>({ name: "Jane" });
    assertType<ShareNotificationFilter>({ after: null });
  });

  it("allows the nullable Quota/changes response argument to be omitted", () => {
    assertType<QuotaChanges.Output>({
      accountId: "account",
      oldState: "old",
      newState: "new",
      hasMoreChanges: false,
      created: [],
      updated: [],
      destroyed: [],
    });
  });

  it("omits server-set properties when creating a principal", () => {
    const principal = {
      type: "individual" as const,
      name: "Jane",
      description: null,
      email: null,
      timeZone: null,
    };
    assertType<PrincipalSet.Input>({ accountId: "account", create: { new: principal } });
    assertType<PrincipalSet.Input>({
      accountId: "account",
      create: {
        // @ts-expect-error capabilities is server-set under RFC 9670 section 2.
        new: { ...principal, capabilities: {} },
      },
    });
    assertType<PrincipalCapabilities>({ "urn:example:capability": { mayShareWith: true } });
    // @ts-expect-error Principal capability values must be objects.
    assertType<PrincipalCapabilities>({ "urn:example:capability": true });
  });

  it("limits share notification set to destruction", () => {
    assertType<ShareNotificationSet.Input>({ accountId: "account", destroy: ["notice"] });
    const invalid = { accountId: "account", update: { notice: {} } };
    // @ts-expect-error RFC 9670 section 3.3 only supports destroy.
    assertType<ShareNotificationSet.Input>(invalid);
  });
});
