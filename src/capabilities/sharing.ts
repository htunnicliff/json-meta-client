import type { Capability } from "../capability.ts";
import type {
  PrincipalChanges,
  PrincipalGet,
  PrincipalsAccountCapabilities,
  PrincipalQuery,
  PrincipalQueryChanges,
  PrincipalSet,
  ShareNotificationChanges,
  ShareNotificationGet,
  ShareNotificationQuery,
  ShareNotificationQueryChanges,
  ShareNotificationSet,
} from "../rfc-types/core/index.ts";

/**
 * Principals and the notifications sent when they share data.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9670.html
 */
export const sharing: Capability<
  "Principal" | "ShareNotification",
  {
    Principal: {
      get: PrincipalGet.Contract;
      changes: PrincipalChanges.Contract;
      set: PrincipalSet.Contract;
      query: PrincipalQuery.Contract;
      queryChanges: PrincipalQueryChanges.Contract;
    };
    ShareNotification: {
      get: ShareNotificationGet.Contract;
      changes: ShareNotificationChanges.Contract;
      set: ShareNotificationSet.Contract;
      query: ShareNotificationQuery.Contract;
      queryChanges: ShareNotificationQueryChanges.Contract;
    };
  },
  "urn:ietf:params:jmap:principals",
  PrincipalsAccountCapabilities
> = {
  urn: "urn:ietf:params:jmap:principals",
  entities: ["Principal", "ShareNotification"],
};
