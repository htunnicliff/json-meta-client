<!-- cspell:words Fastmail -->

# Capabilities

The tables below are generated from the built-in descriptors. Configuration keys are case-sensitive; community keys include their prefix. All listed methods have TypeScript contracts, including Blob, Contacts, and Sieve. Only Core is included automatically. See [Capabilities](/features/capabilities) for server/account checks and composition, and [Extending](/advanced/extending) for custom descriptors.

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail", "community:maskedEmail"],
});

// Requires Fastmail Masked Email support on the chosen account.
const result = await client.api.MaskedEmail.get({
  accountId: "ACCOUNT_ID",
  ids: null,
});
console.log(result.list);
```

## Contracts and protocol sources

The method names in this table are relative to the named entity. Protocol documents define fields, permissions, limits, and errors; selecting a key supplies contracts for the methods listed here, rather than every extension described by those documents.

| Key                     | Typed methods                                                                                                                                                                             | Specification and scope                                                                                                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core`                  | `Core.echo`; `Blob.copy`; `PushSubscription.get`, `set`                                                                                                                                   | [RFC 8620](https://www.rfc-editor.org/rfc/rfc8620.html): echo, blob copying, push subscriptions, and typed server limits. Always available in the client API.                                                 |
| `mail`                  | `Mailbox.get`, `set`, `changes`, `query`, `queryChanges`; `Thread.get`, `changes`; `Email.get`, `changes`, `query`, `queryChanges`, `set`, `copy`, `import`, `parse`; `SearchSnippet.get` | [RFC 8621](https://www.rfc-editor.org/rfc/rfc8621.html): mail storage, search, import, parsing, and typed account limits.                                                                                     |
| `submission`            | `Identity.get`, `set`, `changes`; `EmailSubmission.get`, `set`, `changes`, `query`, `queryChanges`                                                                                        | [RFC 8621 §7](https://www.rfc-editor.org/rfc/rfc8621.html#section-7): sender identities and message submission, with typed account limits and SMTP extensions. Select `mail` separately for Email operations. |
| `vacationResponse`      | `VacationResponse.get`, `set`                                                                                                                                                             | [RFC 8621 §8](https://www.rfc-editor.org/rfc/rfc8621.html#section-8): automatic vacation replies.                                                                                                             |
| `blob`                  | `Blob.upload`, `get`, `lookup`                                                                                                                                                            | [RFC 9404](https://www.rfc-editor.org/rfc/rfc9404.html): JSON blob management and typed account limits. HTTP `client.blob` helpers do not require this key; `Blob.copy` comes from Core.                      |
| `contacts`              | `AddressBook.get`, `changes`, `set`; `ContactCard.get`, `changes`, `query`, `queryChanges`, `set`, `copy`                                                                                 | [RFC 9610](https://www.rfc-editor.org/rfc/rfc9610.html): address books and JSContact cards, with typed account permissions and limits.                                                                        |
| `sieve`                 | `SieveScript.get`, `query`, `set`, `validate`                                                                                                                                             | [RFC 9661](https://www.rfc-editor.org/rfc/rfc9661.html): Sieve scripts, with typed server implementation and account limits/extensions.                                                                       |
| `community:maskedEmail` | `MaskedEmail.get`, `set`                                                                                                                                                                  | [Fastmail Masked Email](https://www.fastmail.com/dev/maskedemail): provider-specific masked addresses. Requires provider support.                                                                             |

Metadata without a declared detail contract remains `unknown`. The catalogue does not export the internal descriptor or RFC type modules as package imports; configure built-ins through the keys above.

<script setup>
  import {data as builtIns } from './capabilities.data.ts';

  const community = Object.entries(builtIns).filter(
    ([name]) => name.startsWith('community:')
  );

  const ready = Object.entries(builtIns).filter(
    ([name]) => !name.startsWith('community:')
  );

  const allEntities = new Set(
    Object.values(builtIns).flatMap(c => c.entities)
  );

  const capabilitiesByEntity = new Map(
    [...allEntities].sort().map(
      (entity) => [
        entity,
        Object.entries(builtIns).filter(
          ([, { entities }]) => entities.includes(entity)
        ).map(([name]) => name)
      ]
    )
  )

</script>

## Built-In

<section v-for="[name, { urn, entities }] in ready" :key="name">
  <h3><code>{{name}}</code></h3>
  <table>
    <tbody>
      <tr>
        <td>URN</td>
        <td>{{urn}}</td>
      </tr>
      <tr>
        <td>Entities</td>
        <td>
          <template v-for="(entity, index) in entities.sort()">
            <code>{{entity}}</code>
            <span v-if="index != entities.length - 1">, </span>
          </template>
        </td>
      </tr>
    </tbody>
  </table>
</section>

## Community

<section v-for="[name, { urn, entities }] in community" :key="name">
  <h3><code>{{name}}</code></h3>
  <table>
    <tbody>
      <tr>
        <td>URN</td>
        <td>{{urn}}</td>
      </tr>
      <tr>
        <td>Entities</td>
        <td>
          <template v-for="(entity, index) in entities.sort()">
            <code>{{entity}}</code>
            <span v-if="index != entities.length - 1">, </span>
          </template>
        </td>
      </tr>
    </tbody>
  </table>
</section>

## By Entity

<table>
  <thead>
    <tr>
      <th>Entity</th>
      <th>Capabilities</th>
    </tr>
  </thead>
  <tbody>
    <tr v-for="[entity, capabilities] in capabilitiesByEntity">
      <td>{{entity}}</td>
      <td>
        <template v-for="(capability, index) in capabilities">
          <code>{{capability}}</code>
          <span v-if="index != capabilities.length - 1">, </span>
        </template>
      </td>
    </tr>
  </tbody>
</table>
