<script setup lang="ts">
import { computed } from "vue";

import type { RecordedRequest } from "../recorder/index.ts";
import BatchCard from "./BatchCard.vue";
import type { Example } from "./examples.ts";
import type { Diagnostic } from "./protocol.ts";
import type { SourceLines } from "./source-lines.ts";
import { buildTimeline } from "./timeline.ts";
import type { BatchEntry, RunStatus, TimelineEntry } from "./timeline.ts";

const props = defineProps<{
  requests: readonly RecordedRequest[];
  status: RunStatus;
  errors: readonly string[];
  diagnostics: readonly Diagnostic[];
  rawJson: boolean;
  /** The built-in example being shown, if any */
  example?: Example;
  /** Where the run's method calls were made and where it waits, when known */
  lines?: SourceLines;
  /** Labels of the method calls to highlight */
  highlighted?: ReadonlySet<string>;
}>();

const emit = defineEmits<{
  showBatched: [code: string];
  hoverCall: [label: string | undefined];
}>();

const entries = computed(() => buildTimeline(props.requests.filter(Boolean)));
const batches = computed(() =>
  entries.value.filter((entry): entry is BatchEntry => entry.kind === "batch"),
);

// One Batch of one method call, then a pending `await`: often a sign that
// later calls wait for a round trip each
const showTip = computed(
  () =>
    props.status === "waiting" &&
    batches.value.length === 1 &&
    batches.value[0]?.calls.length === 1,
);
const firstCall = computed(() => batches.value[0]?.calls[0]);

// Such as "Line 9 awaits Email/query (#1)."
const waitingMessages = computed(() =>
  (props.lines?.waiting ?? []).map(({ range, count, calls }) => {
    const awaited = calls.map(({ label, name }) => `${name} (${label})`).join(", ");
    const what = awaited ? `awaits ${awaited}` : "is waiting";
    const times = count > 1 ? `, ${count} times over` : "";
    return `Line ${range.start.line} ${what}${times}.`;
  }),
);

const kindLabels: Record<Exclude<TimelineEntry["kind"], "batch">, string> = {
  session: "Session",
  upload: "Upload",
  download: "Download",
  eventSource: "Event stream",
  unknown: "Request",
};

function shortUrl(url: string): string {
  try {
    const { pathname, search } = new URL(url);
    return `${pathname}${search}`;
  } catch {
    return url;
  }
}
</script>

<template>
  <ol class="timeline">
    <li v-if="diagnostics.length" class="entry">
      <span class="dot problem" aria-hidden="true" />
      <ul class="problems">
        <li v-for="(diagnostic, index) in diagnostics" :key="index">
          <span v-if="diagnostic.line" class="location"
            >playground.ts:{{ diagnostic.line }}:{{ diagnostic.column }}</span
          >
          {{ diagnostic.message }}
        </li>
      </ul>
    </li>

    <li v-for="entry in entries" :key="entry.key" class="entry" :data-kind="entry.kind">
      <span class="dot" :class="entry.kind === 'batch' ? 'filled' : 'hollow'" aria-hidden="true" />
      <BatchCard
        v-if="entry.kind === 'batch'"
        :batch="entry"
        :raw-json="rawJson"
        :call-sites="lines?.calls"
        :highlighted="highlighted"
        @hover-call="emit('hoverCall', $event)"
      />
      <div v-else class="request">
        <div class="request-line">
          <code class="method">{{ entry.method }}</code>
          <code class="url" :title="entry.url">{{ shortUrl(entry.url) }}</code>
          <span class="kind">{{ kindLabels[entry.kind] }}</span>
          <span v-if="entry.kind === 'session'" class="pill"
            >Placeholder Session · answered by the playground</span
          >
          <span v-else class="pill pending">pending</span>
        </div>
        <pre
          v-if="entry.kind !== 'session' && entry.body !== undefined"
          class="body"
        ><code>{{ typeof entry.body === "string" ? entry.body : JSON.stringify(entry.body, null, 2) }}</code></pre>
      </div>
    </li>

    <li v-if="errors.length" class="entry">
      <span class="dot problem" aria-hidden="true" />
      <ul class="problems">
        <li v-for="(error, index) in errors" :key="index">{{ error }}</li>
      </ul>
    </li>

    <li v-if="status === 'waiting'" class="entry">
      <span class="dot clock" aria-hidden="true" />
      <div class="marker waiting">
        <strong>Waiting for a response</strong>
        <p v-for="(message, index) in waitingMessages" :key="index" class="awaits">
          {{ message }}
        </p>
        <p>
          The playground doesn't answer method calls, so code after the pending
          <code>await</code> hasn't run.
        </p>
      </div>
    </li>
    <li v-else-if="status === 'finished'" class="entry">
      <span class="dot hollow" aria-hidden="true" />
      <div class="marker">
        <strong>Run finished</strong>
        <p v-if="entries.length">
          The code ran to the end. Its requests stay pending, since the playground doesn't answer
          them.
        </p>
        <p v-else>The code ran to the end without making a request.</p>
      </div>
    </li>
    <li v-else-if="status === 'running' || status === 'stuck'" class="entry">
      <span class="dot hollow" aria-hidden="true" />
      <div class="marker" :class="{ stuck: status === 'stuck' }">
        <strong>{{ status === "stuck" ? "Still running" : "Running…" }}</strong>
        <p v-if="status === 'stuck'">
          The code may be in an infinite loop. Editing it stops this run and starts a new one.
        </p>
      </div>
    </li>

    <li v-if="showTip && firstCall" class="entry">
      <span class="dot none" aria-hidden="true" />
      <aside class="tip">
        <strong>Calls after this <code>await</code> each cost a round trip</strong>
        <p>
          Only {{ firstCall.label }} <code>{{ firstCall.name }}</code> was sent before the code
          waited for its result. A method call that needs that result goes in a second Batch. Pass a
          result reference, such as <code>.resultRef("/ids")</code>, instead: the server resolves
          it, and both calls go in Batch 1.
        </p>
        <div class="compare">
          <div class="compare-case">
            <span class="compare-title">Awaiting each call</span>
            <span class="bars"
              ><span class="bar sent" /><span class="gap">wait</span><span class="bar later"
            /></span>
            <span class="compare-result">2 Batches · 2 round trips</span>
          </div>
          <div class="compare-case">
            <span class="compare-title">With a result reference</span>
            <span class="bars"><span class="bar batched" /></span>
            <span class="compare-result">1 Batch · 1 round trip</span>
          </div>
        </div>
        <button
          v-if="example?.batched"
          type="button"
          class="tip-button"
          @click="emit('showBatched', example.batched)"
        >
          Show the batched version
        </button>
      </aside>
    </li>
  </ol>
</template>

<style scoped>
.timeline {
  position: relative;
  margin: 0;
  padding: 0;
  list-style: none;
}

.entry {
  position: relative;
  padding: 0 0 12px 28px;
}

/* The rail joining the entries */
.entry::before {
  content: "";
  position: absolute;
  top: 14px;
  bottom: -2px;
  left: 7px;
  border-left: 2px dotted var(--vp-c-divider);
}

.entry:last-child::before {
  display: none;
}

.dot {
  position: absolute;
  top: 6px;
  left: 1px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--vp-c-bg);
}

.dot.hollow {
  border: 2px solid var(--vp-c-text-3);
}

.dot.filled {
  top: 12px;
  background: var(--vp-c-brand-1);
}

.dot.clock {
  border: 2px solid var(--vp-c-yellow-1);
}

.dot.clock::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 4px;
  width: 3px;
  height: 4px;
  border-left: 1.5px solid var(--vp-c-yellow-1);
  border-bottom: 1.5px solid var(--vp-c-yellow-1);
}

.dot.problem {
  background: var(--vp-c-danger-1);
}

.dot.none {
  display: none;
}

.request-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  min-height: 26px;
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

[data-kind="upload"] .method {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.url {
  overflow-wrap: anywhere;
  color: var(--vp-c-text-1);
}

.kind {
  color: var(--vp-c-text-2);
}

.pill {
  margin-left: auto;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--vp-c-tip-soft);
  color: var(--vp-c-tip-1);
  font-size: 12px;
}

.pill.pending {
  background: var(--vp-c-yellow-soft);
  color: var(--vp-c-yellow-1);
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

.location {
  font-weight: 600;
}

.marker {
  padding: 10px 14px;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 10px;
  font-size: 14px;
}

.marker.waiting {
  border-color: var(--vp-c-yellow-2);
  background: var(--vp-c-yellow-soft);
}

.marker.stuck {
  border-color: var(--vp-c-danger-2);
}

.marker .awaits {
  color: var(--vp-c-text-1);
  font-weight: 500;
}

.marker p {
  margin: 4px 0 0;
  color: var(--vp-c-text-2);
  line-height: 1.5;
}

.tip {
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--vp-c-tip-soft);
  font-size: 14px;
  line-height: 1.5;
}

.tip strong {
  color: var(--vp-c-tip-1);
}

.tip p {
  margin: 6px 0 0;
}

.compare {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.compare-case {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--vp-c-bg);
}

.compare-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--vp-c-text-2);
}

.bars {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.bar {
  flex: 1;
  height: 14px;
  border-radius: 3px;
}

.bar.sent {
  background: var(--vp-c-brand-1);
}

.bar.later {
  border: 1.5px dashed var(--vp-c-brand-1);
}

.bar.batched {
  background: var(--vp-c-tip-1);
}

.compare-result {
  font-size: 13px;
}

.tip-button {
  margin-top: 12px;
  padding: 6px 14px;
  border-radius: 8px;
  background: var(--vp-c-tip-1);
  color: var(--vp-c-bg);
  font-weight: 600;
}

.tip-button:hover {
  opacity: 0.9;
}
</style>
