---
"json-meta-client": major
---

**Breaking:** result references now follow RFC 8620 §3.7. A `resultRef()`
is accepted only as a whole, top-level argument; the types reject one nested
in an object value (such as a `filter` condition) or an array item. The
client now rejects a method call with the new `ResultReferenceError` before
sending it when a reference is nested, when the arguments name both `foo`
and `#foo`, when a reference names a call from an earlier batch, or when
another call in the same batch already uses its method call ID. The rest of
the batch is still sent.
