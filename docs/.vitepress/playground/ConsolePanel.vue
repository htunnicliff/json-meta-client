<script setup lang="ts">
import type { ConsoleLevel } from "./protocol.ts";

export interface ConsoleLine {
  level: ConsoleLevel;
  text: string;
}

defineProps<{ lines: readonly ConsoleLine[]; waiting: boolean }>();
</script>

<template>
  <ol v-if="lines.length" class="console" aria-label="Console output">
    <li v-for="(line, index) in lines" :key="index" class="line" :data-level="line.level">
      <span class="level">{{ line.level }}</span>
      <pre class="text">{{ line.text }}</pre>
    </li>
  </ol>
  <p v-else class="empty">
    No console output{{
      waiting ? ". The code is waiting for a response, so later logs haven't run." : "."
    }}
  </p>
</template>

<style scoped>
.console {
  margin: -12px;
  padding: 0;
  list-style: none;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
}

.line {
  display: grid;
  grid-template-columns: 5ch minmax(0, 1fr);
  gap: 12px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.line[data-level="warn"] {
  background: var(--vp-c-warning-soft);
  color: var(--vp-c-warning-1);
}

.line[data-level="error"] {
  background: var(--vp-c-danger-soft);
  color: var(--vp-c-danger-1);
}

.level {
  color: var(--vp-c-text-3);
  user-select: none;
}

.text {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: inherit;
}

.empty {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 14px;
}
</style>
