<script setup lang="ts">
import { autocompletion } from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
import { syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { classHighlighter } from "@lezer/highlight";
import {
  tsAutocompleteWorker,
  tsFacetWorker,
  tsHoverWorker,
  tsLinterWorker,
  tsSyncWorker,
} from "@valtown/codemirror-ts";
import { basicSetup } from "codemirror";
import { withBase } from "vitepress";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";

import type { RecordedRequest } from "../../recorder/index.ts";
import type { Diagnostic } from "../protocol.ts";
import { createRunner } from "../runner.ts";
import type { Runner, RunnerEvent } from "../runner.ts";
import { encodeShare } from "../share.ts";
import { buildTimeline } from "../timeline.ts";
import type { BatchEntry, RunStatus } from "../timeline.ts";
import { batchChain } from "./chain.ts";
import { embedWorker } from "./worker-client.ts";

const props = defineProps<{ initialCode: string }>();
const emit = defineEmits<{ ready: [] }>();

// How long typing must pause before the code runs again
const RUN_DELAY_MS = 400;
// How long a new run's results wait to replace the last run's while it has not settled
const SHOW_PARTIAL_AFTER_MS = 600;

let embeds = 0;

interface RunView {
  requests: (RecordedRequest | undefined)[];
  errors: string[];
  diagnostics: Diagnostic[];
  status: RunStatus;
}

const emptyView = (): RunView => ({ requests: [], errors: [], diagnostics: [], status: "running" });

const host = ref<HTMLElement>();
const code = ref(props.initialCode);
const view = shallowRef<RunView>(emptyView());
const showJson = ref(false);
const playgroundHref = ref(withBase("/playground"));
let editor: EditorView | undefined;
let runner: Runner | undefined;
let runTimer: ReturnType<typeof setTimeout> | undefined;
let showTimer: ReturnType<typeof setTimeout> | undefined;
let next: RunView | undefined;

function show() {
  clearTimeout(showTimer);
  if (next) view.value = next;
  next = undefined;
}

function update(change: (current: RunView) => Partial<RunView>) {
  if (next) next = { ...next, ...change(next) };
  else view.value = { ...view.value, ...change(view.value) };
}

function onEvent(event: RunnerEvent) {
  switch (event.type) {
    case "start":
      next = emptyView();
      clearTimeout(showTimer);
      showTimer = setTimeout(show, SHOW_PARTIAL_AFTER_MS);
      break;
    case "request":
      update(({ requests }) => {
        const copy = [...requests];
        copy[event.index] = event.request;
        return { requests: copy };
      });
      break;
    case "idle":
      update(() => ({ status: event.finished ? "finished" : "waiting" }));
      show();
      break;
    case "diagnostics":
      update(() => ({ diagnostics: event.diagnostics, status: "failed" }));
      show();
      break;
    case "error":
      update(({ errors }) => ({
        errors: errors.includes(event.message) ? errors : [...errors, event.message],
        status: "failed",
      }));
      show();
      break;
  }
}

const batches = computed(() =>
  buildTimeline(view.value.requests).filter((entry): entry is BatchEntry => entry.kind === "batch"),
);
const callCount = computed(() =>
  batches.value.reduce((total, batch) => total + batch.calls.length, 0),
);
const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
const lastLabel = computed(() => batches.value.at(-1)?.calls.at(-1)?.label);
const json = computed(() =>
  batches.value.map(({ body }) => JSON.stringify(body, null, 2)).join("\n\n"),
);

function setCode(value: string) {
  if (!editor) return;
  editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
}

watch(code, async (value) => {
  clearTimeout(runTimer);
  runTimer = setTimeout(() => runner?.run(value), RUN_DELAY_MS);
  playgroundHref.value = `${withBase("/playground")}#${await encodeShare(value)}`;
});

onMounted(async () => {
  const worker = embedWorker();
  const path = `/embed-${++embeds}.ts`;
  editor = new EditorView({
    parent: host.value,
    doc: props.initialCode,
    extensions: [
      basicSetup,
      javascript({ typescript: true }),
      syntaxHighlighting(classHighlighter),
      tsFacetWorker.of({ worker, path }),
      tsSyncWorker(),
      tsLinterWorker(),
      autocompletion({ override: [tsAutocompleteWorker()] }),
      tsHoverWorker(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) code.value = update.state.doc.toString();
      }),
    ],
  });
  runner = createRunner(onEvent, { compile: (source) => worker.compile(source) });
  runner.run(code.value);
  playgroundHref.value = `${withBase("/playground")}#${await encodeShare(code.value)}`;
  emit("ready");
});

onBeforeUnmount(() => {
  clearTimeout(runTimer);
  clearTimeout(showTimer);
  runner?.dispose();
  editor?.destroy();
});
</script>

<template>
  <div class="embed">
    <header class="embed-header">
      <span class="title">TypeScript</span>
      <span class="live"><span class="dot" />Live</span>
      <button type="button" class="action reset" @click="setCode(props.initialCode)">Reset</button>
      <a class="action open" :href="playgroundHref" target="_blank" rel="noopener"
        >Open in Playground</a
      >
    </header>
    <div ref="host" class="editor" />
    <footer class="output" aria-live="polite">
      <div class="output-header">
        <span class="output-title">JMAP Request</span>
        <span class="summary"
          >{{ count(batches.length, "Batch") }} · {{ count(callCount, "method call") }}</span
        >
        <button
          v-if="batches.length"
          type="button"
          class="action json"
          @click="showJson = !showJson"
        >
          {{ showJson ? "Hide JSON" : "Show JSON" }}
        </button>
      </div>
      <ul v-if="view.diagnostics.length || view.errors.length" class="problems">
        <li v-for="(diagnostic, index) in view.diagnostics" :key="`d${index}`">
          <template v-if="diagnostic.line">Line {{ diagnostic.line }}: </template
          >{{ diagnostic.message }}
        </li>
        <li v-for="(error, index) in view.errors" :key="`e${index}`">{{ error }}</li>
      </ul>
      <div v-for="batch in batches" :key="batch.key" class="chain">
        <span v-if="batches.length > 1" class="batch-label">Batch {{ batch.number }}</span>
        <template v-for="(link, index) in batchChain(batch)" :key="index">
          <span
            v-if="link.kind === 'call'"
            class="call"
            :class="{ waiting: view.status === 'waiting' && link.label === lastLabel }"
            ><span class="label">{{ link.label }}</span> {{ link.name }}</span
          >
          <span v-else class="reference">→ {{ link.path }} →</span>
        </template>
      </div>
      <p class="trailer">
        <template v-if="view.status === 'waiting'">
          {{ batches.length ? "then waits for a response" : "Waiting for a response" }}
        </template>
        <template v-else-if="view.status === 'finished'">
          {{ batches.length ? "then finishes" : "Finished without a JMAP Request" }}
        </template>
        <template v-else-if="view.status === 'running'">Running…</template>
      </p>
      <pre v-if="showJson && batches.length" class="json-view"><code>{{ json }}</code></pre>
    </footer>
  </div>
</template>

<style scoped>
.embed {
  margin: 16px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}

.embed-header,
.output-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.embed-header {
  padding: 8px 16px;
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 14px;
}

.title {
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.live {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--vp-c-green-soft);
  color: var(--vp-c-green-1);
  font-size: 12px;
}

.live .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.action {
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-2);
}

.reset {
  margin-left: auto;
}

.vp-doc .open,
.open {
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.editor {
  background: var(--vp-code-block-bg);
}

.output {
  padding: 10px 16px 12px;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 13px;
}

.output-title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--vp-c-text-2);
}

.summary {
  color: var(--vp-c-text-2);
}

.json {
  margin-left: auto;
  color: var(--vp-c-tip-1);
}

.chain {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  margin-top: 8px;
}

.batch-label {
  color: var(--vp-c-text-2);
}

.call {
  padding: 2px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-1);
}

.call.waiting {
  border-color: var(--vp-c-brand-2);
  background: var(--vp-c-brand-soft);
}

.label {
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.reference {
  font-family: var(--vp-font-family-mono);
  font-weight: 600;
  color: var(--vp-c-tip-1);
}

.trailer {
  margin: 6px 0 0;
  color: var(--vp-c-text-2);
}

.problems {
  margin: 8px 0 0;
  padding: 6px 10px;
  border-radius: 6px;
  list-style: none;
  background: var(--vp-c-danger-soft);
  color: var(--vp-c-danger-1);
  font-family: var(--vp-font-family-mono);
}

.vp-doc .problems li + li {
  margin-top: 0;
}

.json-view {
  margin: 8px 0 0;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--vp-code-block-bg);
  font-size: 12px;
  overflow-x: auto;
}
</style>

<style>
/* CodeMirror, on the docs site's code colors */
.embed .cm-editor {
  font-size: 14px;
  background: var(--vp-code-block-bg);
  color: var(--vp-c-text-1);
}

.embed .cm-editor.cm-focused {
  outline: none;
}

.embed .cm-scroller {
  font-family: var(--vp-font-family-mono);
  line-height: 1.6;
}

.embed .cm-gutters {
  border-right: none;
  background: var(--vp-code-block-bg);
  color: var(--vp-c-text-3);
}

.embed .cm-activeLine,
.embed .cm-activeLineGutter {
  background: transparent;
}

.embed .cm-content {
  caret-color: var(--vp-c-text-1);
}

.embed .tok-keyword,
.embed .tok-operatorKeyword {
  color: var(--vp-c-brand-1);
}

.embed .tok-string,
.embed .tok-string2 {
  color: var(--vp-c-tip-1);
}

.embed .tok-number,
.embed .tok-bool {
  color: var(--vp-c-green-1);
}

.embed .tok-comment {
  color: var(--vp-c-text-3);
  font-style: italic;
}

.embed .tok-typeName,
.embed .tok-className {
  color: var(--vp-c-purple-1, var(--vp-c-indigo-1));
}

.embed .cm-tooltip {
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-elv);
  color: var(--vp-c-text-1);
}

.embed .cm-tooltip-autocomplete > ul > li[aria-selected] {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-text-1);
}
</style>
