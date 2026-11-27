---
"json-meta-client": major
---

**Breaking:** result references now follow RFC 8620 §3.7. A `resultRef()`
must be a whole, top-level argument. The types reject one nested in an
object, such as a `filter` condition, or in an array.

The client also rejects a method call with the new `ResultReferenceError`,
without sending it, when:

- a reference is nested,
- the arguments name both `foo` and `#foo`,
- a reference points to a call from an earlier batch, or
- another call in the same batch already uses its method call ID.

The rest of the batch is still sent.
