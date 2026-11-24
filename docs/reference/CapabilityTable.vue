<script setup lang="ts">
import type { BuiltInCapability } from "./capabilities.data.ts";

const { capability } = defineProps<{ capability: BuiltInCapability }>();

const entities = capability.entities.toSorted();

// Methods set to `null` in `defaultAccount` get no `accountId` from the client
const withoutDefaultAccount = Object.entries(capability.defaultAccount ?? {})
  .filter(([, account]) => account === null)
  .map(([method]) => method);
</script>

<template>
  <table>
    <tbody>
      <tr>
        <td>URN</td>
        <td>
          <code>{{ capability.urn }}</code>
        </td>
      </tr>
      <tr>
        <td>Specification</td>
        <td>
          <a :href="capability.spec.url" target="_blank" rel="noreferrer">{{
            capability.spec.title
          }}</a>
        </td>
      </tr>
      <tr v-if="capability.dependsOn">
        <td>Also sends</td>
        <td>
          <template v-for="(urn, index) in capability.dependsOn" :key="urn">
            <code>{{ urn }}</code>
            <span v-if="index != capability.dependsOn.length - 1">, </span>
          </template>
        </td>
      </tr>
      <tr v-if="capability.extends">
        <td>Extends</td>
        <td>
          <code>{{ capability.extends }}</code>
        </td>
      </tr>
      <tr v-if="withoutDefaultAccount.length > 0">
        <td>No default account</td>
        <td>
          <template v-for="(method, index) in withoutDefaultAccount" :key="method">
            <code>{{ method }}</code>
            <span v-if="index != withoutDefaultAccount.length - 1">, </span>
          </template>
        </td>
      </tr>
      <tr>
        <td>Methods</td>
        <td>
          <template v-if="Object.keys(capability.methods).length === 0">
            None. Adds properties and filter conditions to the methods it extends.
          </template>
          <template v-for="entity in entities" :key="entity">
            <div v-if="capability.methods[entity]">
              <code>{{ entity }}</code>:
              <template v-for="(method, index) in capability.methods[entity]" :key="method">
                <code>{{ method }}</code>
                <span v-if="index != capability.methods[entity].length - 1">, </span>
              </template>
            </div>
          </template>
        </td>
      </tr>
      <tr v-if="capability.accountDetails.length > 0">
        <td>Account details</td>
        <td>
          <div v-for="field in capability.accountDetails" :key="field.name">
            <code>{{ field.name }}{{ field.optional ? "?" : "" }}: {{ field.type }}</code>
          </div>
        </td>
      </tr>
      <tr v-if="capability.sessionDetails.length > 0">
        <td>Session details</td>
        <td>
          <div v-for="field in capability.sessionDetails" :key="field.name">
            <code>{{ field.name }}{{ field.optional ? "?" : "" }}: {{ field.type }}</code>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</template>
