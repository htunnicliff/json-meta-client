import type { Session } from "jmap-rfc-types";

import { mail } from "../../capabilities/mail.ts";
import type { Middleware } from "../types.ts";

export function injectAccountId(getSession: () => Session): Middleware {
  return (args) => {
    // Add `accountId` if not set
    if (
      typeof args === "object" &&
      args !== null &&
      !Array.isArray(args) &&
      !Object.hasOwn(args, "accountId")
    ) {
      Object.defineProperty(args, "accountId", {
        get: () => getSession().primaryAccounts[mail.urn],
        enumerable: true,
      });
    }

    return args;
  };
}
