import type { Capability } from "../capability.ts";
import type {
  SieveAccountCapabilities,
  SieveScriptGet,
  SieveScriptQuery,
  SieveScriptSet,
  SieveScriptValidate,
  SieveSessionCapabilities,
} from "../rfc-types/mail/index.ts";

// cspell:words enotify extlists

export const sieve: Capability<
  "SieveScript",
  {
    SieveScript: {
      get: SieveScriptGet.Contract;
      query: SieveScriptQuery.Contract;
      set: SieveScriptSet.Contract;
      validate: SieveScriptValidate.Contract;
    };
  },
  "urn:ietf:params:jmap:sieve",
  SieveAccountCapabilities,
  SieveSessionCapabilities
> = {
  urn: "urn:ietf:params:jmap:sieve",
  entities: ["SieveScript"],
};
