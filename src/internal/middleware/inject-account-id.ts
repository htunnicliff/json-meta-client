import type { Session } from "jmap-rfc-types";

import { mail } from "../../capabilities/mail.ts";
import type { Middleware } from "../types.ts";

export function injectAccountId(getSession: () => Session): Middleware {
  return (args, context) => {
    // Add `accountId` if not set
    if (
      context?.method !== "Core/echo" &&
      typeof args === "object" &&
      args !== null &&
      !Array.isArray(args) &&
      !Object.hasOwn(args, "accountId") &&
      !Object.hasOwn(args, "#accountId")
    ) {
      Object.defineProperty(args, "accountId", {
        get: () => getSession().primaryAccounts[mail.urn],
        enumerable: true,
      });
    }

    return args;
  };
}
