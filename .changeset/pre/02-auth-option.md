---
"json-meta-client": major
---

**Breaking:** the required `auth` option replaces `bearerToken`. There is no
alias for the old option.

```ts
// 0.14
new JsonMetaClient({
  bearerToken: token,
  sessionUrl,
  capabilities,
});

// 1.0
new JsonMetaClient({
  auth: token,
  sessionUrl,
  capabilities,
});
```

`auth` also accepts Basic credentials, which the client encodes, or a
callback that changes each outgoing request:

```ts
// Basic credentials
auth: { username, password },

// A callback
auth: async ({ request }) => {
  request.headers.set("Authorization", `Bearer ${await getToken()}`);
},
```

Authentication applies to every request the client makes: session
discovery, method calls, blob transfers, and each event stream connection
and reconnect. The callback runs for each one, so it can supply fresh
credentials.
