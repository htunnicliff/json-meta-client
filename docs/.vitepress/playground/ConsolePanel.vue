<script setup lang="ts">
import type { ConsoleLevel } from "./protocol.ts";

export interface ConsoleLine {
  level: ConsoleLevel;
  text: string;
}

defineProps<{ logs: readonly ConsoleLine[] }>();
</script>

<template>
  <ol v-if="logs.length" class="console" aria-label="Console output">
    <li v-for="(line, index) in logs" :key="index" class="log" :data-level="line.level">
      <span class="level">{{ line.level }}</span>
      <pre class="text">{{ line.text }}</pre>
    </li>
  </ol>
  <p v-else class="empty">Output from <code>console</code> appears here.</p>
</template>

<style scoped>
.console {
  margin: 0;
  padding: 0;
  list-style: none;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
}

.log {
  display: grid;
  grid-template-columns: 6ch minmax(0, 1fr);
  gap: 8px;
  padding: 2px 0;
  border-bottom: 1px solid var(--vp-c-divider);
}

.log:last-child {
  border-bottom: none;
}

.level {
  color: var(--vp-c-text-2);
}

.log[data-level="warn"] {
  color: var(--vp-c-warning-1);
}

.log[data-level="error"] {
  color: var(--vp-c-danger-1);
}

.text {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* Centered in the pane */
.empty {
  margin: auto;
  text-align: center;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
</style>
