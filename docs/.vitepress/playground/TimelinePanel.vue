<script setup lang="ts">
import { computed } from "vue";

import type { RecordedRequest, RecordedResponse } from "../recorder/index.ts";
import ClipBox from "./ClipBox.vue";
import type { Diagnostic } from "./protocol.ts";
import RawJson from "./RawJson.vue";
import type { SourceLines } from "./source-lines.ts";
import { defaultTimelineOptions } from "./timeline-options.ts";
import type { TimelineOptions } from "./timeline-options.ts";
import { buildTimeline } from "./timeline.ts";
import type { RunStatus, TimelineEntry } from "./timeline.ts";

const props = defineProps<{
  requests: readonly (RecordedRequest | undefined)[];
  /** Responses by request index: placeholder Sessions, and those from a connected server */
  responses?: readonly (RecordedResponse | undefined)[];
  /** The host of the connected server, if any */
  connected?: string;
  status: RunStatus;
  errors: readonly string[];
  diagnostics: readonly Diagnostic[];
  /** Where the run's method calls were made and where it waits, when known */
  lines?: SourceLines;
  /** Labels of the method calls to highlight */
  highlighted?: ReadonlySet<string>;
  /** Which parts of the timeline to show */
  options?: TimelineOptions;
}>();

const emit = defineEmits<{ hoverCall: [label: string | undefined] }>();

const show = computed(() => props.options ?? defaultTimelineOptions);

const entries = computed(() =>
  buildTimeline(props.requests).filter((entry) => show.value.sessions || entry.kind !== "session"),
);

const kindLabels: Record<Exclude<TimelineEntry["kind"], "batch">, string> = {
  session: "Session",
  upload: "Upload",
  download: "Download",
  eventSource: "Event stream",
  unknown: "Request",
};

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

    <ol v-if="entries.length" class="entries" aria-label="Requests">
      <li v-for="(entry, position) in entries" :key="entry.key" class="entry">
        <span class="step" aria-hidden="true">{{ position + 1 }}</span>
        <header class="entry-header">
          <span class="entry-title">{{
            entry.kind === "batch" ? `Batch ${entry.number}` : kindLabels[entry.kind]
          }}</span>
          <code class="method" :data-method="entry.method">{{ entry.method }}</code>
          <span class="target">
            <code class="url" :title="entry.url">{{ shortUrl(entry.url) }}</code>
            <span
              v-if="entry.kind === 'session' && !connected"
              class="mocked"
              title="Not sent. Without a connected server, the playground answers with a placeholder Session that supports every built-in capability. Connect a server to fetch its real Session."
              >Mocked</span
            >
            <span v-else-if="responses?.[entry.index]" class="aside">
              HTTP {{ responses[entry.index]!.status || "failed" }}
            </span>
          </span>
        </header>
        <template v-if="show.requestBodies">
          <ClipBox v-if="entry.kind === 'batch'" :clip="show.clipLong">
            <RawJson
              class="entry-body"
              :batch="entry"
              label="JMAP Request as sent"
              :highlighted="highlighted"
              :line-numbers="show.lineNumbers"
              :notes="show.callLabels"
              @hover-call="emit('hoverCall', $event)"
            />
          </ClipBox>
          <ClipBox
            v-else-if="entry.kind !== 'session' && entry.body !== undefined"
            :clip="show.clipLong"
          >
            <pre class="entry-body plain"><code>{{ formatBody(entry.body) }}</code></pre>
          </ClipBox>
        </template>
        <template v-if="show.responses && responses?.[entry.index]?.body !== undefined">
          <h4 v-if="show.requestBodies && entry.kind !== 'session'" class="response-heading">
            Response
          </h4>
          <ClipBox :clip="show.clipLong">
            <pre
              v-if="typeof responses![entry.index]!.body === 'string'"
              class="entry-body plain"
            ><code>{{ responses![entry.index]!.body }}</code></pre>
            <RawJson
              v-else
              class="entry-body"
              :body="responses![entry.index]!.body"
              :label="entry.kind === 'session' ? 'Session' : 'Response'"
              :line-numbers="show.lineNumbers"
            />
          </ClipBox>
        </template>
      </li>
    </ol>

    <ul v-if="errors.length" class="problems">
      <li v-for="(error, index) in errors" :key="index">{{ error }}</li>
    </ul>

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

/*
 * The steps share one grid: each entry is a subgrid row, so the title and
 * method columns are as wide as the widest title and method in this run.
 */
.entries {
  display: grid;
  grid-template-columns: 21px max-content max-content minmax(0, 1fr);
  gap: 12px 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.entry {
  position: relative;
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  row-gap: 8px;
  min-width: 0;
}

/* The rail joining each step to the next */
.entry:not(:last-child)::before {
  content: "";
  position: absolute;
  top: 21px;
  bottom: -12px;
  left: 10px;
  border-left: 1px solid var(--vp-c-border);
}

.step {
  display: grid;
  grid-column: 1;
  place-items: center;
  width: 21px;
  height: 21px;
  border: 1px solid var(--vp-c-border);
  border-radius: 50%;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font-size: 11px;
}

.entry-header {
  display: grid;
  grid-column: 2 / -1;
  grid-template-columns: subgrid;
  align-items: center;
  min-width: 0;
  font-size: 13px;
  line-height: 21px;
}

.entry-title {
  white-space: nowrap;
  font-weight: 600;
}

.method {
  justify-self: start;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--vp-c-green-soft);
  color: var(--vp-c-green-1);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.method[data-method="POST"] {
  background: var(--vp-c-indigo-soft);
  color: var(--vp-c-indigo-1);
}

.target {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.url {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--vp-c-text-2);
  font-size: 12px;
}

.aside {
  flex: none;
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.mocked {
  flex: none;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--vp-c-warning-soft);
  color: var(--vp-c-warning-1);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  line-height: 18px;
  text-transform: uppercase;
  cursor: help;
}

/* Bodies and responses span from the title column to the end */
.entry > :not(.step, .entry-header) {
  grid-column: 2 / -1;
  min-width: 0;
}

.entry-body {
  border-radius: 6px;
  background: var(--vp-code-block-bg);
}

.plain {
  margin: 0;
  padding: 8px 12px;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.6;
  overflow-x: auto;
}

.response-heading {
  margin: 4px 0 0;
  font-size: 13px;
  font-weight: 600;
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
