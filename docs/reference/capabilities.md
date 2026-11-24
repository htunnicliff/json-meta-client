# Capabilities

This page lists every capability the client knows by name. Pass a name in the
[`capabilities`](./api.md#capabilities) option to enable that capability's
entities and methods on `client.api`, and to type its details on the session.
For a guided introduction, refer to the [Capabilities guide](../features/capabilities.md).

Each entry below is generated from the library's source, so it always matches
the installed version:

- **URN**: the identifier the client sends in a JMAP Request's `using` array.
- **Specification**: the document that defines the capability.
- **Also sends**: other URNs the client adds to `using` when calling the
  capability's methods.
- **Extends**: the capability whose method contracts this one adds to. The
  client must be configured with both.
- **No default account**: methods for which the client won't fill in
  `accountId`, so the call must pass one.
- **Methods**: each entity's methods, called as `client.api.<Entity>.<method>()`.
- **Account details** and **Session details**: the typed fields of
  `session.accounts[id].accountCapabilities[urn]` and
  `session.capabilities[urn]`. Refer to
  [Reading capability details](../features/capabilities.md#reading-capability-details).

## Default capability

`core` (`urn:ietf:params:jmap:core`) is always enabled, whether or not it is
listed in `capabilities`. Every JMAP Request includes its URN, and its methods,
`Core/echo`, `Blob/copy`, `PushSubscription/get` and `PushSubscription/set`, are
always available on `client.api`. Its session details, such as
`maxCallsInRequest` and `maxSizeUpload`, are typed on every client's session.

```ts
const session = await client.session;
const limits =
  session.capabilities["urn:ietf:params:jmap:core"]!;

console.log(limits.maxCallsInRequest, limits.maxSizeUpload);
```

<script setup>
  import { data as builtIns } from './capabilities.data.ts';
  import CapabilityTable from './CapabilityTable.vue';

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
  );
</script>

## Built-In

<section v-for="[name, capability] in ready" :key="name">
  <h3 :id="name"><code>{{name}}</code></h3>
  <CapabilityTable :capability="capability" />
</section>

## Community

Community capabilities are defined by a server vendor rather than by an RFC.
Their names start with `community:`, and they are enabled the same way as
the others.

<section v-for="[name, capability] in community" :key="name">
  <h3 :id="name"><code>{{name}}</code></h3>
  <CapabilityTable :capability="capability" />
</section>

## By Entity

An entity that appears in more than one capability, such as `Blob`, sends the
URN of every enabled capability that declares it.

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
          <a :href="`#${capability}`"><code>{{capability}}</code></a>
          <span v-if="index != capabilities.length - 1">, </span>
        </template>
      </td>
    </tr>
  </tbody>
</table>
