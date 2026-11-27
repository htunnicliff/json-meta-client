---
"json-meta-client": minor
---

Add `patch()`, which changes only some keys of an object in a `/set`
call's `update`. The client sends each key as a JSON Pointer path, escaping
`~` and `/` in it, and IDs from a variable keep their types:

```ts
await client.api.Email.set({
  update: {
    [emailId]: {
      mailboxIds: patch({
        [inboxId]: null,
        [archiveId]: true,
      }),
      keywords: patch({ $seen: true }),
    },
  },
});
```

A plain object is still the property's whole new value, as in JMAP.
`onSuccessUpdateEmail` accepts `patch()` too. The `update` types are now
`UpdatePatch<T>`, exported from `json-meta-client/rfc-types` with
`Patch<T>` and `PatchValue<T>`; `PatchObject<T>` remains the wire form.
