/**
 * The fragment parameter of a playground link that holds code, as in
 * `/playground#code=…`. The code is compressed with raw DEFLATE and encoded as
 * base64url; the docs build writes these links next to examples.
 */
export const PLAYGROUND_CODE_PARAM = "code";

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/**
 * The code a playground link's fragment holds, if it holds any that can be
 * read
 */
export async function readCodeLink(hash: string): Promise<string | undefined> {
  const encoded = new URLSearchParams(hash.replace(/^#/, "")).get(PLAYGROUND_CODE_PARAM);
  if (!encoded) return undefined;
  try {
    const stream = new Blob([fromBase64Url(encoded)])
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(stream).text();
  } catch {
    // A link cut short or edited by hand; the playground keeps its own code
    return undefined;
  }
}
