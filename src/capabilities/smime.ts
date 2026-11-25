import type { ExtendingCapability } from "../capability.ts";
import type { EmptyCapabilityDetails } from "../rfc-types/core/index.ts";
import type { EmailSmimeFilter, EmailSmimeProperties } from "../rfc-types/mail/index.ts";

// cspell:words smime smimeverify

/**
 * Adds the S/MIME verification URN to every `Email` and `SearchSnippet`
 * request, and types the `smime*` properties of `Email/get` and the
 * `hasSmime` and `hasVerifiedSmime` filter conditions. It adds no methods
 * and extends `mail`, which the client requires alongside it.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9219.html
 */
export const smime: ExtendingCapability<{
  entity: "Email" | "SearchSnippet";
  urn: "urn:ietf:params:jmap:smimeverify";
  extendedUrn: "urn:ietf:params:jmap:mail";
  accountCapabilities: EmptyCapabilityDetails;
  sessionCapabilities: EmptyCapabilityDetails;
  contractExtensions: {
    Email: {
      properties: EmailSmimeProperties;
      filter: EmailSmimeFilter;
    };
  };
}> = {
  urn: "urn:ietf:params:jmap:smimeverify",
  entities: ["Email", "SearchSnippet"],
  extends: "urn:ietf:params:jmap:mail",
};
