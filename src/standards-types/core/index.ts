import type { Rfc8620SessionCapabilities } from "./rfc8620-jmap.ts";
import type { Rfc8620AccountCapabilities } from "./rfc8620-jmap.ts";
import type { Rfc8887SessionCapabilities } from "./rfc8887-websocket.ts";
import type { Rfc9404SessionCapabilities } from "./rfc9404-blobs.ts";
import type { Rfc9404AccountCapabilities } from "./rfc9404-blobs.ts";
import type { Rfc9425SessionCapabilities } from "./rfc9425-quotas.ts";
import type { Rfc9425AccountCapabilities } from "./rfc9425-quotas.ts";
import type { Rfc9670SessionCapabilities } from "./rfc9670-sharing.ts";
import type { Rfc9670AccountCapabilities } from "./rfc9670-sharing.ts";
import type { Rfc9749SessionCapabilities } from "./rfc9749-vapid.ts";

export * from "./rfc8620-jmap.ts";
export * from "./rfc8887-websocket.ts";
export * from "./rfc9404-blobs.ts";
export * from "./rfc9425-quotas.ts";
export * from "./rfc9670-sharing.ts";
export * from "./rfc9749-vapid.ts";

export interface SessionCapabilities
  extends
    Rfc8620SessionCapabilities,
    Rfc8887SessionCapabilities,
    Rfc9404SessionCapabilities,
    Rfc9425SessionCapabilities,
    Rfc9670SessionCapabilities,
    Rfc9749SessionCapabilities {}
export interface AccountCapabilities
  extends
    Rfc8620AccountCapabilities,
    Rfc9404AccountCapabilities,
    Rfc9425AccountCapabilities,
    Rfc9670AccountCapabilities {}
