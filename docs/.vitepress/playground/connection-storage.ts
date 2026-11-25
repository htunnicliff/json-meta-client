import type { Connection } from "./protocol.ts";

const STORAGE_KEY = "json-meta-client:playground:connection";

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function isConnection(value: unknown): value is Connection {
  if (!isObject(value) || !("sessionUrl" in value) || !("auth" in value)) {
    return false;
  }
  const { sessionUrl, auth } = value;
  if (typeof sessionUrl !== "string") {
    return false;
  }
  if (typeof auth === "string") {
    return true;
  }
  return (
    isObject(auth) &&
    "username" in auth &&
    "password" in auth &&
    typeof auth.username === "string" &&
    typeof auth.password === "string"
  );
}

/**
 * The connection the user chose to remember in this browser, if any
 */
export function loadConnection(): Connection | undefined {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return isConnection(stored) ? { sessionUrl: stored.sessionUrl, auth: stored.auth } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Remember a connection in this browser, credentials included, until it is
 * forgotten
 */
export function saveConnection({ sessionUrl, auth }: Connection): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionUrl, auth }));
  } catch {
    // Storage can be unavailable, as in a private window; the connection lasts the visit
  }
}

export function forgetConnection(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing was stored
  }
}
