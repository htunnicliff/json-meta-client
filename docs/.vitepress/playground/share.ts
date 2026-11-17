/**
 * Playground code in the URL hash, as `#code/1/<data>`: the code as UTF-8,
 * compressed with raw DEFLATE and base64url-encoded. Only the code goes in
 * the hash, never credentials or other state.
 */

const PREFIX = "code/1/";

/** The longest hash accepted, in characters */
export const MAX_HASH_LENGTH = 32_000;
/** The most code a hash may decompress to, in bytes */
export const MAX_CODE_BYTES = 200_000;

/**
 * The hash, without `#`, that holds this code
 */
export async function encodeShare(code: string): Promise<string> {
  const stream = new Blob([code]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return `${PREFIX}${toBase64Url(bytes)}`;
}

export type DecodedShare =
  /** The hash holds no shared code */
  | { kind: "none" }
  | { kind: "code"; code: string }
  /** The hash looks like shared code but cannot be read */
  | { kind: "invalid"; reason: string };

/**
 * Read the code from a hash, with or without its `#`. Never throws.
 */
export async function decodeShare(hash: string): Promise<DecodedShare> {
  const value = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!value.startsWith("code/")) return { kind: "none" };
  if (!value.startsWith(PREFIX)) return { kind: "invalid", reason: "unsupported version" };
  if (value.length > MAX_HASH_LENGTH) return { kind: "invalid", reason: "too long" };
  try {
    const bytes = fromBase64Url(value.slice(PREFIX.length));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const code = await readText(stream, MAX_CODE_BYTES);
    return code === undefined ? { kind: "invalid", reason: "too large" } : { kind: "code", code };
  } catch {
    return { kind: "invalid", reason: "malformed" };
  }
}

/**
 * Read a stream as UTF-8, or `undefined` once it passes `limit` bytes, so a
 * small hash cannot expand into a huge string
 */
async function readText(
  stream: ReadableStream<Uint8Array>,
  limit: number,
): Promise<string | undefined> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "";
  let total = 0;
  for (;;) {
    // oxlint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    total += value.byteLength;
    if (total > limit) {
      void reader.cancel();
      return undefined;
    }
    text += decoder.decode(value, { stream: true });
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  if (!/^[\w-]*$/.test(text)) throw new Error("Not base64url");
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
