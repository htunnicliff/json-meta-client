# API

## Client

```ts
const client = new JsonMetaClient({
  bearerToken: "<token>",
  sessionUrl: "<url>",
  capabilities: [
    "mail",
    "contacts",xx
  ],
  logger?: Pick<typeof console, "error" | "warn" | "info" | "debug">,
});
```

### Options

- `bearerToken` - A valid bearer token
- `sessionUrl` - The URI for creating a JMAP session
- `capabilities` - An array of capabilities
- `logger` (optional) -
- `middleware` (optional) -

### Return Value
