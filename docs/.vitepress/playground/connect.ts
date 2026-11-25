import type { Connection } from "./protocol.ts";

/**
 * The `Authorization` header for a connection's credentials, as the library
 * sends it
 */
export function authorization(auth: Connection["auth"]): string {
  if (typeof auth === "string") {
    return `Bearer ${auth}`;
  }
  const bytes = new TextEncoder().encode(`${auth.username}:${auth.password}`);
  return `Basic ${btoa(String.fromCharCode(...bytes))}`;
}

export type ConnectionCheck = { ok: true; username?: string } | { ok: false; message: string };

/**
 * Fetch the Session once, and explain why a connection fails: the server
 * cannot be reached, does not allow this site through CORS, rejects the
 * credentials, or does not answer with a JMAP Session
 */
export async function checkConnection(
  { sessionUrl, auth }: Pick<Connection, "sessionUrl" | "auth">,
  fetch: typeof globalThis.fetch = globalThis.fetch,
): Promise<ConnectionCheck> {
  let url: URL;
  try {
    url = new URL(sessionUrl);
  } catch {
    return { ok: false, message: "The Session URL is not a valid URL." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, message: "The Session URL must start with https:// or http://." };
  }
  let response: Response;
  try {
    response = await fetch(url, { headers: { authorization: authorization(auth) } });
  } catch {
    // Browsers report a request that CORS blocks like one that never left.
    // A request that needs no CORS permission tells them apart.
    const reachable = await fetch(url, { mode: "no-cors" }).then(
      () => true,
      () => false,
    );
    return {
      ok: false,
      message: reachable
        ? `${url.host} answered, but doesn't allow this site through CORS. Allow cross-origin requests on the server, then try again.`
        : `Couldn't reach ${url.host}. Check the URL, and that the server is running.`,
    };
  }
  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      message: `${url.host} rejected the credentials (HTTP ${response.status}).`,
    };
  }
  if (!response.ok) {
    return { ok: false, message: `${url.host} answered with HTTP ${response.status}.` };
  }
  const session: unknown = await response.json().catch(() => undefined);
  if (!session || typeof session !== "object" || !("apiUrl" in session)) {
    return { ok: false, message: `${url.host} didn't answer with a JMAP Session.` };
  }
  const username = "username" in session ? session.username : undefined;
  return typeof username === "string" ? { ok: true, username } : { ok: true };
}
