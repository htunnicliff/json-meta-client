// cspell:words smime smimeverify

/**
 * Servers may return additional status tokens defined by future extensions.
 * @see https://www.rfc-editor.org/info/rfc9219/#section-4.1
 */
export type SmimeStatus =
  | "unknown"
  | "signed"
  | "signed/verified"
  | "signed/failed"
  | "encrypted+signed/verified"
  | "encrypted+signed/failed"
  | (string & {});

/** @see https://www.rfc-editor.org/info/rfc9219/#section-4.1 */
export interface EmailSmimeProperties {
  smimeStatus: SmimeStatus | null;
  smimeStatusAtDelivery: SmimeStatus | null;
  smimeErrors: string[] | null;
  smimeVerifiedAt: string | null;
}

/** @see https://www.rfc-editor.org/info/rfc9219/#section-4.2 */
export interface EmailSmimeFilter {
  hasSmime?: boolean;
  hasVerifiedSmime?: boolean;
}
