declare module "./index.ts" {
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

  export namespace PrincipalGet {
    export interface Input extends MethodGet.Input<Principal> {}
    export interface Output<Args> extends MethodGet.Output<Principal, Args> {}
    export interface Contract {
      input: Input;
      output: Output<this["input"]>;
    }
  }

  export namespace PrincipalChanges {
    export interface Input extends MethodChanges.Input {}
    export interface Output extends MethodChanges.Output {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export namespace PrincipalSet {
    export interface Input extends MethodSet.Input<Principal> {}
    export interface Output extends MethodSet.Output<Principal> {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export interface PrincipalFilter {
    accountIds: string[];
    email: string;
    name: string;
    text: string;
    type: string;
    timeZone: string;
  }

  export namespace PrincipalQuery {
    export interface Input extends MethodQuery.Input<Principal, PrincipalFilter> {}
    export interface Output extends MethodQuery.Output {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export namespace PrincipalQueryChanges {
    export interface Input extends MethodQueryChanges.Input<Principal, PrincipalFilter> {}
    export interface Output extends MethodQueryChanges.Output {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

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

  export namespace ShareNotificationGet {
    export interface Input extends MethodGet.Input<ShareNotification> {}
    export interface Output<Args> extends MethodGet.Output<ShareNotification, Args> {}
    export interface Contract {
      input: Input;
      output: Output<this["input"]>;
    }
  }

  export namespace ShareNotificationChanges {
    export interface Input extends MethodChanges.Input {}
    export interface Output extends MethodChanges.Output {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export namespace ShareNotificationSet {
    export interface Input extends MethodSet.Input<ShareNotification> {}
    export interface Output extends MethodSet.Output<ShareNotification> {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export interface ShareNotificationFilter {
    after: string | null;
    before: string | null;
    objectType: string;
    objectAccountId: string;
  }

  export namespace ShareNotificationQuery {
    export interface Input extends MethodQuery.Input<ShareNotification, ShareNotificationFilter> {}
    export interface Output extends MethodQuery.Output {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export namespace ShareNotificationQueryChanges {
    export interface Input extends MethodQueryChanges.Input<
      ShareNotification,
      ShareNotificationFilter
    > {}

    export interface Output extends MethodQueryChanges.Output {}

    export interface Contract {
      input: Input;
      output: Output;
    }
  }
}
