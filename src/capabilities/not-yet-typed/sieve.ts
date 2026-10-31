import type { Capability } from "../../capability.ts";
import type {
  MethodGet,
  MethodQuery,
  MethodSet,
  SetError,
} from "../../standards-types/core/index.ts";

// cspell:words enotify extlists

/**
 * Server implementation advertised by the JMAP Sieve capability.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9661.html#section-1.2.1
 */
export interface SieveSessionCapabilities {
  implementation: string;
}

/**
 * Account limits and extensions advertised by the JMAP Sieve capability.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9661.html#section-1.2.1
 */
export interface SieveAccountCapabilities {
  maxSizeScriptName: number;
  /** Maximum script size in octets, or null for no limit. */
  maxSizeScript: number | null;
  maxNumberScripts: number | null;
  maxNumberRedirects: number | null;
  sieveExtensions: string[];
  /** Supported notification URI schemes, or null if enotify is unsupported. */
  notificationMethods: string[] | null;
  /** Supported external list URI schemes, or null if extlists is unsupported. */
  externalLists: string[] | null;
}

export const sieve: Capability<
  "SieveScript",
  {
    SieveScript: {
      get: {
        input: MethodGet.Input<any>;
        output: MethodGet.Output<any, any>;
      };
      query: {
        input: MethodQuery.Input<any>;
        output: MethodQuery.Output;
      };
      set: {
        input: MethodSet.Input<any>;
        output: MethodSet.Output<any>;
      };
      validate: {
        input: {
          accountId: string;
          blobId: string;
        };
        output: {
          accountId: string;
          error: SetError<any> | null;
        };
      };
    };
  },
  "urn:ietf:params:jmap:sieve",
  SieveAccountCapabilities,
  SieveSessionCapabilities
> = {
  urn: "urn:ietf:params:jmap:sieve",
  entities: ["SieveScript"],
};
