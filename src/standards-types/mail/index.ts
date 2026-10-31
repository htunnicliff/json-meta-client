import type { Rfc8621SessionCapabilities } from "./rfc8621-mail.ts";
import type { Rfc8621AccountCapabilities } from "./rfc8621-mail.ts";

export * from "./rfc8621-mail.ts";
export * from "./rfc9007-mdn.ts";
export * from "./rfc9219-mime.ts";
export * from "./rfc9661-sieve.ts";

export interface SessionCapabilities extends Rfc8621SessionCapabilities {}
export interface AccountCapabilities extends Rfc8621AccountCapabilities {}
