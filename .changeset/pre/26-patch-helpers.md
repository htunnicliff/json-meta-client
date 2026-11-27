---
"json-meta-client": minor
---

Add `patch()` and `patchMap()` for partial updates in a `/set` call's
`update`. A plain object is still the property's whole new value, as in
JMAP.

`patch()` changes only the keys it's given:

```ts
await client.api.Email.set({
  update: {
    [emailId]: {
      keywords: patch({ $seen: true }),
    },
  },
});
```

`patchMap()` builds the paths for a map keyed by ID, such as `mailboxIds`.
A computed key built from a variable ID is typed as `string`, so the
compiler can't check it. `patchMap()` checks the map's name and values:

```ts
await client.api.Email.set({
  update: {
    [emailId]: patchMap("mailboxIds", {
      [inboxId]: null,
      [archiveId]: true,
    }),
  },
});
```

Both send each key as a JSON Pointer path, escaping `~` and `/`.
`onSuccessUpdateEmail` accepts them too. The `update` types are now
`UpdatePatch<T>`, exported from `json-meta-client/rfc-types` with `Patch<T>`
and `PatchValue<T>`.
