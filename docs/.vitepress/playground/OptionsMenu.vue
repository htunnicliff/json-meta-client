<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

import { timelineOptionKeys as keys, timelineOptionLabels } from "./timeline-options.ts";
import type { TimelineOptions } from "./timeline-options.ts";

const options = defineModel<TimelineOptions>({ required: true });

const menu = ref<HTMLDetailsElement>();

function set(key: keyof TimelineOptions, value: boolean) {
  options.value = { ...options.value, [key]: value };
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
    <summary class="trigger" aria-label="Timeline options" title="Timeline options">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="3" cy="8" r="1.5" />
        <circle cx="8" cy="8" r="1.5" />
        <circle cx="13" cy="8" r="1.5" />
      </svg>
    </summary>
    <div class="popover" role="group" aria-labelledby="timeline-options-title">
      <span id="timeline-options-title" class="title">Timeline</span>
      <label v-for="key in keys" :key="key" class="option">
        <input
          type="checkbox"
          :checked="options[key]"
          @change="set(key, ($event.target as HTMLInputElement).checked)"
        />
        {{ timelineOptionLabels[key] }}
      </label>
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

.option input {
  accent-color: var(--vp-c-brand-1);
}
</style>
