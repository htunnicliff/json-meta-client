---
"json-meta-client": patch
---

Remove the `type-fest` runtime dependency. The few type helpers the
library used are now part of the library, so its published types no longer
import from `type-fest`, and a new `type-fest` major can't change them.
