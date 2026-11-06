<!-- cspell:words Fastmail -->

# Capability catalogue

Built-in capability keys select the method contracts listed below. Keys are
case-sensitive, including the `community:` prefix. Only Core is automatic;
other capabilities must be configured explicitly.

The tables of URIs and entities are generated from the built-in descriptors.
The [capability guide](../features/capabilities.md) explains how configuration
relates to server support, account permissions, and request requirements.

## Method contracts

Every method listed here has a TypeScript contract. A protocol specification
provides the method's fields, permissions, limits, and error definitions;
selecting a key exposes the listed methods, rather than every possible extension
to that protocol.

### `core`

Included in every client. Provides typed server limits and these methods from
[RFC 8620](https://www.rfc-editor.org/rfc/rfc8620.html):

- `Core.echo`
- `Blob.copy`
- `PushSubscription.get`, `set`

### `mail`

Mail storage, search, import, and parsing, with typed account limits from
[RFC 8621](https://www.rfc-editor.org/rfc/rfc8621.html):

- `Mailbox.get`, `set`, `changes`, `query`, `queryChanges`
- `Thread.get`, `changes`
- `Email.get`, `changes`, `query`, `queryChanges`, `set`, `copy`, `import`, `parse`
- `SearchSnippet.get`

### `submission`

Sender identities and message submission from
[RFC 8621 §7](https://www.rfc-editor.org/rfc/rfc8621.html#section-7), with typed
account limits and SMTP extensions:

- `Identity.get`, `set`, `changes`
- `EmailSubmission.get`, `set`, `changes`, `query`, `queryChanges`

Does not include `mail`. Email creation and submission workflows need both keys.

### `vacationResponse`

Automatic vacation replies from
[RFC 8621 §8](https://www.rfc-editor.org/rfc/rfc8621.html#section-8):

- `VacationResponse.get`, `set`

### `blob`

JSON-based blob management and typed account limits from
[RFC 9404](https://www.rfc-editor.org/rfc/rfc9404.html):

- `Blob.upload`, `get`, `lookup`

The HTTP `client.blob` helpers do not require this key. `Blob.copy` comes from Core.

### `contacts`

Address books and JSContact cards from
[RFC 9610](https://www.rfc-editor.org/rfc/rfc9610.html), with typed account
permissions and limits:

- `AddressBook.get`, `changes`, `set`
- `ContactCard.get`, `changes`, `query`, `queryChanges`, `set`, `copy`

### `sieve`

Sieve scripts from [RFC 9661](https://www.rfc-editor.org/rfc/rfc9661.html), with
typed server implementation details and account limits/extensions:

- `SieveScript.get`, `query`, `set`, `validate`

### `community:maskedEmail`

Provider-specific masked addresses from the
[Fastmail Masked Email API](https://www.fastmail.com/dev/maskedemail):

- `MaskedEmail.get`, `set`

Requires provider support. Metadata without a declared detail contract remains
`unknown`, including for other capabilities above.

<script setup>
import { data as builtIns } from './capabilities.data.ts'

const capabilities = Object.entries(builtIns);
const allEntities = new Set(
  Object.values(builtIns).flatMap(capability => capability.entities)
);
const capabilitiesByEntity = [...allEntities].sort().map(entity => [
  entity,
  capabilities.filter(([, capability]) => capability.entities.includes(entity))
    .map(([name]) => name)
]);
</script>

## Capability URIs and entities

<table>
  <thead>
    <tr><th>Configuration key</th><th>URI</th><th>Entities</th></tr>
  </thead>
  <tbody>
    <tr v-for="[name, { urn, entities }] in capabilities" :key="name">
      <td><code>{{ name }}</code></td>
      <td><code>{{ urn }}</code></td>
      <td>
        <template v-for="(entity, index) in [...entities].sort()" :key="entity">
          <code>{{ entity }}</code><span v-if="index < entities.length - 1">, </span>
        </template>
      </td>
    </tr>
  </tbody>
</table>

## Capabilities by entity

An entity can appear in several descriptors. A request calling that entity uses
all its configured capability URIs, even when the called method comes from only
one descriptor.

<table>
  <thead>
    <tr><th>Entity</th><th>Configuration keys</th></tr>
  </thead>
  <tbody>
    <tr v-for="[entity, names] in capabilitiesByEntity" :key="entity">
      <td><code>{{ entity }}</code></td>
      <td>
        <template v-for="(name, index) in names" :key="name">
          <code>{{ name }}</code><span v-if="index < names.length - 1">, </span>
        </template>
      </td>
    </tr>
  </tbody>
</table>

Built-ins are configured by key. Their internal descriptors and RFC type
modules are not public package entry points. Custom server features can be described
with [capability-authoring APIs](../advanced/extending.md).
