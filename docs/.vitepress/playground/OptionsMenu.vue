<script setup lang="ts" generic="Options extends { [Key in keyof Options]: boolean }">
import { onBeforeUnmount, onMounted, ref, useId } from "vue";

import { optionKeys } from "./stored-options.ts";
import type { OptionSet } from "./stored-options.ts";

const props = defineProps<{
  /** The options the menu toggles */
  set: OptionSet<Options>;
  /** What the options are for, as in "Timeline" */
  title: string;
}>();

defineSlots<{
  /** Buttons that act once, below the options */
  actions?(props: { close: () => void }): unknown;
}>();

const options = defineModel<Options>({ required: true });

const menu = ref<HTMLDetailsElement>();
const titleId = useId();
const keys = optionKeys(props.set);

function set(key: keyof Options, value: boolean) {
  options.value = { ...options.value, [key]: value };
}

function close() {
  if (menu.value) menu.value.open = false;
}

// Close on a click elsewhere or Escape, as other menus do
function onPointerDown(event: PointerEvent) {
  if (menu.value?.open && !menu.value.contains(event.target as Node)) menu.value.open = false;
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== "Escape" || !menu.value?.open) return;
  menu.value.open = false;
  menu.value.querySelector("summary")?.focus();
}

onMounted(() => {
  addEventListener("pointerdown", onPointerDown);
  addEventListener("keydown", onKeyDown);
});

onBeforeUnmount(() => {
  removeEventListener("pointerdown", onPointerDown);
  removeEventListener("keydown", onKeyDown);
});
</script>

<template>
  <details ref="menu" class="menu">
    <summary class="trigger" :aria-label="`${title} options`" :title="`${title} options`">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="3" cy="8" r="1.5" />
        <circle cx="8" cy="8" r="1.5" />
        <circle cx="13" cy="8" r="1.5" />
      </svg>
    </summary>
    <div class="popover" role="group" :aria-labelledby="titleId">
      <span :id="titleId" class="title">{{ title }}</span>
      <label v-for="key in keys" :key="key" class="option">
        <input
          type="checkbox"
          :checked="options[key]"
          @change="set(key, ($event.target as HTMLInputElement).checked)"
        />
        {{ props.set.labels[key] }}
      </label>
      <div v-if="$slots.actions" class="actions">
        <slot name="actions" :close="close" />
      </div>
    </div>
  </details>
</template>

<style scoped>
.menu {
  position: relative;
}

.trigger {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  color: var(--vp-c-text-2);
  cursor: pointer;
  list-style: none;
}

.trigger::-webkit-details-marker {
  display: none;
}

.trigger:hover,
.menu[open] .trigger {
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-1);
}

.trigger svg {
  fill: currentColor;
}

.popover {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  min-width: 200px;
  padding: 6px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-elv);
  box-shadow: var(--vp-shadow-3);
  font-weight: 400;
}

.title {
  padding: 4px 8px;
  color: var(--vp-c-text-2);
  font-size: 12px;
  font-weight: 600;
}

.option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 6px;
  color: var(--vp-c-text-1);
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
}

.option:hover {
  background: var(--vp-c-default-soft);
}

.actions {
  display: flex;
  flex-direction: column;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--vp-c-divider);
}

.actions :slotted(button) {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 8px;
  border-radius: 6px;
  color: var(--vp-c-text-1);
  font-size: 13px;
  text-align: left;
  white-space: nowrap;
}

.actions :slotted(button:hover) {
  background: var(--vp-c-default-soft);
}

.actions :slotted(kbd) {
  color: var(--vp-c-text-2);
  font-family: inherit;
  font-size: 12px;
}

.option input {
  accent-color: var(--vp-c-brand-1);
}
</style>
