import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/index.ts", "rfc-types": "src/rfc-types/index.ts" },
  publint: true,
  exports: true,
  attw: true,
  target: ["es2023"],
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
