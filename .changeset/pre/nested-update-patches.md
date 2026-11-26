---
"json-meta-client": major
---

**Breaking:** a plain object in a `/set` call's `update` is now a patch.
The client flattens it into JSON Pointer paths before sending, escaping
`~` and `/` in each key, so it changes only the keys it names:

```ts
await client.api.Email.set({
  update: {
    [emailId]: {
      mailboxIds: { [inboxId]: null, [archiveId]: true },
      keywords: { $seen: true },
    },
  },
});
```

Before, `mailboxIds: { [archiveId]: true }` replaced the whole map. Wrap
the object in the new `replace()` to keep that behavior:
`mailboxIds: replace({ [archiveId]: true })`. Keys that contain `/` are
still sent as they are. `onSuccessUpdateEmail` is flattened the same way.

The `update` types are now `UpdatePatch<T>`, exported from
`json-meta-client/rfc-types` with `NestedPatch<T>` and `Replace<T>`.
`PatchObject<T>` remains the wire form.
