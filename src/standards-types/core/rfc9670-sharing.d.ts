declare namespace JMAP {
  export interface SessionCapabilities {
    "urn:ietf:params:jmap:principals": {};
  }

  export interface AccountCapabilities {
    "urn:ietf:params:jmap:principals": {
      currentUserPrincipalId: string | null;
    };
    "urn:ietf:params:jmap:principals:owner": {
      accountIdForPrincipal: string;
      principalId: string;
    };
  }

  export type PrincipalType = "individual" | "group" | "resource" | "location" | "other";

  export interface PrincipalCapabilities {}

  export interface Principal {
    id: string;
    type: PrincipalType;
    name: string;
    description: string | null;
    email: string | null;
    timeZone: string | null;
    capabilities: PrincipalCapabilities;
    accounts: { [id: string]: Account };
  }

  export interface PrincipalGetArguments extends GetArguments<Principal> {}

  export interface PrincipalGetResponse extends GetResponse<Principal, PrincipalGetArguments> {}

  export interface PrincipalChangesArguments extends ChangesArguments {}

  export interface PrincipalChangesResponse extends ChangesResponse {}

  export interface PrincipalSetArguments extends SetArguments<Principal> {}

  export interface PrincipalSetResponse extends SetResponse<Principal, PrincipalSetArguments> {}

  export interface PrincipalFilter {
    accountIds: string[];
    email: string;
    name: string;
    text: string;
    type: string;
    timeZone: string;
  }

  export interface PrincipalQueryArguments extends QueryArguments<Principal, PrincipalFilter> {}

  export interface PrincipalQueryResponse extends QueryResponse {}

  export interface PrincipalQueryChangesArguments extends QueryChangesArguments<
    Principal,
    PrincipalFilter
  > {}

  export interface PrincipalQueryChangesResponse extends QueryChangesResponse {}

  export interface ShareNotificationEntity {
    name: string;
    email: string | null;
    principalId: string | null;
  }

  export interface SharingRights {
    [permission: string]: boolean;
  }

  export interface ShareNotification {
    id: string;
    created: string;
    changedBy: ShareNotificationEntity;
    objectType: string;
    objectAccountId: string;
    objectId: string;
    oldRights: SharingRights;
    newRights: SharingRights;
    name: string;
  }

  export interface Shareable {
    isSubscribed: boolean;
    myRights: SharingRights;
    shareWith: { [principalId: string]: SharingRights };
  }

  export interface ShareNotificationGetArguments extends GetArguments<ShareNotification> {}

  export interface ShareNotificationGetResponse extends GetResponse<
    ShareNotification,
    ShareNotificationGetArguments
  > {}

  export interface ShareNotificationChangesArguments extends ChangesArguments {}

  export interface ShareNotificationChangesResponse extends ChangesResponse {}

  export interface ShareNotificationSetArguments extends SetArguments<ShareNotification> {}

  export interface ShareNotificationSetResponse extends SetResponse<
    ShareNotification,
    ShareNotificationSetArguments
  > {}

  export interface ShareNotificationFilter {
    after: string | null;
    before: string | null;
    objectType: string;
    objectAccountId: string;
  }

  export interface ShareNotificationQueryArguments extends QueryArguments<
    ShareNotification,
    ShareNotificationFilter
  > {}

  export interface ShareNotificationQueryResponse extends QueryResponse {}

  export interface ShareNotificationQueryChangesArguments extends QueryChangesArguments<
    ShareNotification,
    ShareNotificationFilter
  > {}

  export interface ShareNotificationQueryChangesResponse extends QueryChangesResponse {}
}
