---
"json-meta-client": major
---

**Breaking:** the published package now ships one bundled entry point.
`dist/index.mjs` and `dist/index.d.mts` replace the per-file `dist/**/*.js`
and `.d.ts` output. Imports from `json-meta-client` are unchanged; deep
imports into `dist/` no longer resolve.
