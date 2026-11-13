/**
 * The compiler options the playground checks code with.
 *
 * They match the ones `scripts/check-docs.mjs` checks documented examples
 * with, except for module resolution: Monaco only supports Node's older
 * resolution, and the library ships as a single declaration file, so there is
 * nothing for the newer modes to resolve.
 */
export const playgroundCompilerOptions = {
  target: "ESNext",
  module: "ESNext",
  moduleResolution: "NodeJs",
  strict: true,
  noUncheckedIndexedAccess: true,
} as const;
