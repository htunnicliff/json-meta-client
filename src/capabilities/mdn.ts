import type { Capability } from "../capability.ts";
import type { MDNParse, MDNSend } from "../rfc-types/mail/index.ts";

export const mdn: Capability<
  "MDN",
  {
    MDN: {
      send: MDNSend.Contract;
      parse: MDNParse.Contract;
    };
  },
  "urn:ietf:params:jmap:mdn"
> = {
  urn: "urn:ietf:params:jmap:mdn",
  entities: ["MDN"],
  // MDN/send implicitly updates Emails and uses Identities.
  // See https://www.rfc-editor.org/rfc/rfc9007.html#section-2.1
  dependsOn: ["urn:ietf:params:jmap:mail"],
};
