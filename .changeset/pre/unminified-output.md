---
"json-meta-client": patch
---

The published JavaScript is no longer minified, so stack traces and debugger
steps inside the library show the original names. JSDoc comments are
stripped from the JavaScript (the type declarations keep them). Bundlers minify it as part
of an application's build as before.
