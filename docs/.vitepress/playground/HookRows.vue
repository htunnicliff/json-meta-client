<script setup lang="ts">
import type { HookUpdate } from "./protocol.ts";

defineProps<{
  calls: readonly HookUpdate[];
  phase: "before" | "after";
}>();
</script>

<template>
  <ol class="hooks" :aria-label="phase === 'before' ? 'Request hooks' : 'Response hooks'">
    <li v-for="call in calls" :key="`${call.name}-${call.position}`" class="hook">
      <code class="name">{{ call.name }}</code>
      <code class="callback">{{ call.callback || `#${call.position}` }}</code>
      <span class="state" :data-state="call.status">{{
        call.status === "running"
          ? "Running…"
          : call.status === "completed"
            ? "Completed"
            : phase === "before"
              ? "Failed before send"
              : "Failed"
      }}</span>
      <span v-if="call.message" class="message">{{ call.message }}</span>
    </li>
  </ol>
</template>

<style scoped>
.hooks {
  padding: 0 0 0 12px;
  margin: 0;
  border-inline-start: 1px solid var(--vp-c-divider);
  list-style: none;
}

.hook {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 8px;
  min-width: 0;
  padding-block: 2px;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.hook::before {
  content: "";
  position: absolute;
  inset-block-start: 9px;
  inset-inline-start: -15px;
  width: 5px;
  height: 5px;
  background: var(--vp-c-brand-1);
  transform: rotate(45deg);
}

.name {
  color: var(--vp-c-brand-1);
}

.callback,
.state {
  color: var(--vp-c-text-2);
}

.state[data-state="running"] {
  color: var(--vp-c-warning-1);
}

.state[data-state="failed"],
.message {
  color: var(--vp-c-danger-1);
}

.message {
  flex-basis: 100%;
}
</style>
