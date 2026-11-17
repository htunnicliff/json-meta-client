/**
 * Docs examples connect with placeholders, as in
 * `sessionUrl: "<server>"` and `auth: "<credentials>"`. The docs
 * build and the playground fill them in: with the placeholder server, or in
 * the playground, with a server the user connected.
 */

/** Stands for the server's origin in a Session URL */
export const SERVER_PLACEHOLDER = "<server>";

/** Stands for the credentials */
export const CREDENTIALS_PLACEHOLDER = "<credentials>";

/** The origin `<server>` stands for when no server is connected */
export const PLACEHOLDER_ORIGIN = "https://jmap.example.com";

/**
 * A real server to fill placeholders in with
 */
export interface PlaceholderServer {
  sessionUrl: string;
  auth: string | { username: string; password: string };
}

interface ConnectionOptions {
  sessionUrl: string | URL;
  auth?: unknown;
}

/**
 * Whether a Session URL holds the server placeholder
 */
export function hasServerPlaceholder(sessionUrl: unknown): sessionUrl is string {
  return typeof sessionUrl === "string" && sessionUrl.includes(SERVER_PLACEHOLDER);
}

/**
 * Client options with their placeholders filled in. With a server, a Session
 * URL holding `<server>` becomes the server's Session URL and `auth: "<credentials>"`
 * its credentials. Without one, `<server>` becomes {@link PLACEHOLDER_ORIGIN}
 * and `<credentials>` stays as is. Other values are kept.
 */
export function fillPlaceholders<Options extends ConnectionOptions>(
  options: Options,
  server?: PlaceholderServer,
): Options {
  const filled = { ...options };
  if (hasServerPlaceholder(options.sessionUrl)) {
    filled.sessionUrl = server
      ? server.sessionUrl
      : options.sessionUrl.replaceAll(SERVER_PLACEHOLDER, PLACEHOLDER_ORIGIN);
  }
  if (server && options.auth === CREDENTIALS_PLACEHOLDER) filled.auth = server.auth;
  return filled;
}
