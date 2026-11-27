---
"json-meta-client": minor
---

Add `patchMap()`, which builds the patch paths for a map keyed by ID, such
as an email's `mailboxIds`. Unlike a computed key such as
``[`mailboxIds/${id}`]``, which TypeScript types as `string`, its map name
and values are checked against the patch type, and its keys are escaped as
JSON Pointer segments:

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
