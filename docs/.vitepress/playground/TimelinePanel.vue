<script setup lang="ts">
import { computed } from "vue";

import type { RecordedRequest, RecordedResponse } from "../recorder/index.ts";
import type { ConsoleLevel, Diagnostic } from "./protocol.ts";
import RawJson from "./RawJson.vue";
import type { SourceLines } from "./source-lines.ts";
import { buildTimeline } from "./timeline.ts";
import type { RunStatus, TimelineEntry } from "./timeline.ts";

export interface ConsoleLine {
  level: ConsoleLevel;
  text: string;
}

const props = defineProps<{
  requests: readonly (RecordedRequest | undefined)[];
  /** Responses from a connected server, by request index */
  responses?: readonly (RecordedResponse | undefined)[];
  /** The host of the connected server, if any */
  connected?: string;
  status: RunStatus;
  errors: readonly string[];
  diagnostics: readonly Diagnostic[];
  logs: readonly ConsoleLine[];
  /** Where the run's method calls were made and where it waits, when known */
  lines?: SourceLines;
  /** Labels of the method calls to highlight */
  highlighted?: ReadonlySet<string>;
}>();

const emit = defineEmits<{ hoverCall: [label: string | undefined] }>();

const entries = computed(() => buildTimeline(props.requests));

const kindLabels: Record<Exclude<TimelineEntry["kind"], "batch">, string> = {
  session: "Session",
  upload: "Upload",
  download: "Download",
  eventSource: "Event stream",
  unknown: "Request",
};

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

function formatBody(body: unknown): string {
  return typeof body === "string" ? body : JSON.stringify(body, null, 2);
}

function shortUrl(url: string): string {
  try {
    const { pathname, search } = new URL(url);
    return `${pathname}${search}`;
  } catch {
    return url;
  }
}

// One line about where the run is, such as "Waiting on #1 Email/query (line 9)"
const statusLine = computed(() => {
  switch (props.status) {
    case "ready":
      return props.connected ? `Ready to run against ${props.connected}` : "Ready to run";
    case "running":
      return "Running…";
    case "finished":
      return "Finished";
    case "failed":
      return "Failed";
    case "waiting": {
      const awaits = (props.lines?.waiting ?? []).map(({ range, calls }) => {
        const awaited = calls.map(({ label, name }) => `${label} ${name}`).join(", ");
        return `${awaited || "a response"} (line ${range.start.line})`;
      });
      return `Waiting on ${awaits.join("; ") || "a response"}`;
    }
  }
});

// Without a server, awaited responses never arrive, so code after the first
// such await, its console output included, never runs
const waitingHint = computed(() => {
  if (props.status !== "waiting" || props.connected) return undefined;
  const line = props.lines?.waiting[0]?.range.start.line;
  const after = line === undefined ? "Code after this await" : `Code after line ${line}`;
  return `${after} runs only when a server responds. Connect to a server to run it.`;
});
</script>

<template>
  <div class="timeline">
    <ul v-if="diagnostics.length" class="problems">
      <li v-for="(diagnostic, index) in diagnostics" :key="index">
        <template v-if="diagnostic.line"
          >Line {{ diagnostic.line }}:{{ diagnostic.column }}: </template
        >{{ diagnostic.message }}
      </li>
    </ul>

    <template v-for="entry in entries" :key="entry.key">
      <article v-if="entry.kind === 'batch'" class="batch">
        <header class="batch-header">
          <span class="batch-title">Batch {{ entry.number }}</span>
          <span class="summary">{{ count(entry.calls.length, "method call") }}</span>
          <span v-if="responses?.[entry.index]" class="status">
            HTTP {{ responses[entry.index]!.status || "failed" }}
          </span>
        </header>
        <RawJson
          :batch="entry"
          label="JMAP Request as sent"
          :highlighted="highlighted"
          @hover-call="emit('hoverCall', $event)"
        />
        <template v-if="responses?.[entry.index]?.body !== undefined">
          <h4 class="response-heading">Response</h4>
          <pre
            v-if="typeof responses![entry.index]!.body === 'string'"
            class="body response"
          ><code>{{ responses![entry.index]!.body }}</code></pre>
          <RawJson v-else :body="responses![entry.index]!.body" label="JMAP Response" />
        </template>
      </article>

      <div v-else class="request" :data-kind="entry.kind">
        <div class="request-line">
          <code class="method">{{ entry.method }}</code>
          <code class="url" :title="entry.url">{{ shortUrl(entry.url) }}</code>
          <span class="kind">{{ kindLabels[entry.kind] }}</span>
          <span v-if="responses?.[entry.index]" class="status">
            HTTP {{ responses[entry.index]!.status || "failed" }}
          </span>
          <span v-else-if="entry.kind === 'session' && !connected" class="note"
            >answered by the playground</span
          >
        </div>
        <pre
          v-if="entry.kind !== 'session' && entry.body !== undefined"
          class="body"
        ><code>{{ formatBody(entry.body) }}</code></pre>
      </div>
    </template>

    <ul v-if="errors.length" class="problems">
      <li v-for="(error, index) in errors" :key="index">{{ error }}</li>
    </ul>

    <ol v-if="logs.length" class="console" aria-label="Console output">
      <li v-for="(line, index) in logs" :key="index" class="log" :data-level="line.level">
        <span class="level">{{ line.level }}</span>
        <pre class="text">{{ line.text }}</pre>
      </li>
    </ol>

    <p class="status-line" :data-status="status" role="status">{{ statusLine }}</p>
    <p v-if="waitingHint" class="hint">{{ waitingHint }}</p>
  </div>
</template>

<style scoped>
.timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.batch {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
}

.batch-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  font-size: 13px;
}

.batch-title {
  font-weight: 600;
}

.summary {
  color: var(--vp-c-text-2);
}

.status {
  margin-left: auto;
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.response-heading {
  margin: 0;
  padding: 6px 12px;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 13px;
  font-weight: 600;
}

.request-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  font-size: 13px;
}

.method {
  padding: 0 6px;
  border-radius: 4px;
  background: var(--vp-c-green-soft);
  color: var(--vp-c-green-1);
  font-size: 12px;
  font-weight: 600;
}

.url {
  overflow-wrap: anywhere;
  color: var(--vp-c-text-1);
}

.kind,
.note {
  color: var(--vp-c-text-2);
}

.note {
  margin-left: auto;
  font-size: 12px;
}

.body {
  margin: 6px 0 0;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--vp-code-block-bg);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  overflow-x: auto;
}

.body.response {
  margin: 0;
  border-radius: 0;
}

.problems {
  margin: 0;
  padding: 8px 12px;
  border-radius: 8px;
  list-style: none;
  background: var(--vp-c-danger-soft);
  color: var(--vp-c-danger-1);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  white-space: pre-wrap;
}

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

.level {
  color: var(--vp-c-text-3);
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

.status-line {
  margin: 0;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.hint {
  margin: -8px 0 0;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.status-line[data-status="waiting"] {
  color: var(--vp-c-yellow-1);
}

.status-line[data-status="failed"] {
  color: var(--vp-c-danger-1);
}
</style>
