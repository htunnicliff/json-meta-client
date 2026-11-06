import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  // Preserve relative RFC module augmentations in the published declarations.
  unbundle: true,
  fixedExtension: false,
  dts: {
    generator: "tsc",
    sourcemap: true,
  },
  publint: true,
  sourcemap: true,
  attw: true,
  target: ["esnext"],
  minify: true,
  banner: [
    "// ----------------------------------------------------------------------- //",
    "//                                                                         //",
    "//   Copyright (c) 2026 Hunter Tunnicliff                                  //",
    "//                                                                         //",
    "//   This source code is subject to the terms of the Mozilla Public        //",
    "//   License, version 2.0. If a copy of the MPL was not distributed with   //",
    "//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //",
    "//                                                                         //",
    "// ----------------------------------------------------------------------- //",
    "",
  ].join("\n"),
});
