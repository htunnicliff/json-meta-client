---
"json-meta-client": patch
---

The published JavaScript is no longer minified, so stack traces and debugger
steps inside the library show the original names. Bundlers minify it as part
of an application's build as before.
