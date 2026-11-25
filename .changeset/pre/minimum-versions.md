---
"json-meta-client": patch
---

Declare the supported runtimes: Node.js 22 or later (`engines` in
`package.json`) and TypeScript 5.4 or later. The build now targets ES2023
instead of `esnext`, and CI checks the packed package on Node.js 22 with
TypeScript 5.4.
