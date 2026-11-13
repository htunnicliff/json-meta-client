/**
 * Replace `crypto.getRandomValues`, which the client draws call ids from, with
 * a generator seeded by `seed`, so the same method calls get the same ids on
 * every run. Docs examples then stay free of explicit `id` options, and the
 * generated JMAP Requests do not change from build to build. Returns a
 * function that restores the original.
 */
export function seedCallIds(seed: number): () => void {
  const original = Object.getOwnPropertyDescriptor(crypto, "getRandomValues");
  const next = mulberry32(seed);
  Object.defineProperty(crypto, "getRandomValues", {
    configurable: true,
    writable: true,
    value: <T extends ArrayBufferView | null>(array: T): T => {
      if (array) {
        const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        for (let index = 0; index < bytes.length; index++) bytes[index] = next() & 0xff;
      }
      return array;
    },
  });
  return () => {
    if (original) Object.defineProperty(crypto, "getRandomValues", original);
    else delete (crypto as { getRandomValues?: unknown }).getRandomValues;
  };
}

/**
 * A small seeded generator of 32-bit unsigned integers. `crypto` offers no
 * seedable generator, so this stands in for it.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}
