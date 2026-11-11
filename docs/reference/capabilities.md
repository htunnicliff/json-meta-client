# Capabilities

:::warning TODO
- Per built-in, to complete the generated tables:
  - Method list per entity (new data loader or hand-written tables)
  - Account and session capability detail fields
  - RFC link
:::

## Default capability

:::warning TODO
- `core` is always enabled
:::

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

<section v-for="[name, { urn, entities, dependsOn }] in ready" :key="name">
  <h3><code>{{name}}</code></h3>
  <table>
    <tbody>
      <tr>
        <td>URN</td>
        <td>{{urn}}</td>
      </tr>
      <tr v-if="dependsOn">
        <td>Also sends</td>
        <td>{{dependsOn.join(", ")}}</td>
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
