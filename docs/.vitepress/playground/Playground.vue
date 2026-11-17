<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";

import type { RecordedRequest, RecordedResponse } from "../recorder/index.ts";
import ConnectDialog from "./ConnectDialog.vue";
import type { CodeEditor } from "./editor.ts";
import { examples, findExample } from "./examples.ts";
import type { SourceInfo, Trace } from "./instrument.ts";
import type { Connection, Diagnostic } from "./protocol.ts";
import { createRunner } from "./runner.ts";
import type { Runner, RunnerEvent } from "./runner.ts";
import { labelsAt, sourceLines } from "./source-lines.ts";
import { buildTimeline } from "./timeline.ts";
import type { RunStatus } from "./timeline.ts";
import TimelinePanel from "./TimelinePanel.vue";
import type { ConsoleLine } from "./TimelinePanel.vue";

/**
 * What the panel shows of a run
 */
interface RunView {
  requests: RecordedRequest[];
  diagnostics: Diagnostic[];
  errors: string[];
  logs: ConsoleLine[];
  /** Responses from a connected server, by request index */
  responses: (RecordedResponse | undefined)[];
  status: RunStatus;
  /** The code the run ran */
  code: string;
  source?: SourceInfo;
  trace?: Trace;
}

const emptyView = (code: string, status: RunStatus): RunView => ({
  requests: [],
  diagnostics: [],
  errors: [],
  logs: [],
  responses: [],
  status,
  code,
});

const code = ref(examples[0]!.code);
const view = shallowRef<RunView>(emptyView(code.value, "ready"));
const editorHost = ref<HTMLElement>();
let editor: CodeEditor | undefined;
let runner: Runner | undefined;
let unmounted = false;

function update(change: (current: RunView) => Partial<RunView>) {
  view.value = { ...view.value, ...change(view.value) };
}

function onEvent(event: RunnerEvent) {
  switch (event.type) {
    case "start":
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
      break;
    case "diagnostics":
      update(() => ({ diagnostics: event.diagnostics, status: "failed" }));
      break;
    case "error":
      update(({ errors, logs }) => ({
        // Calls of one Batch fail together, often with the same error
        errors: errors.includes(event.message) ? errors : [...errors, event.message],
        logs: [...logs, { level: "error", text: event.message }],
        status: "failed",
      }));
      break;
    case "compiled":
      update(() => ({ source: event.source }));
      break;
    case "trace":
      update(() => ({ trace: event.trace }));
      break;
    case "response":
      update(({ responses }) => {
        const copy = [...responses];
        copy[event.index] = event.response;
        return { responses: copy };
      });
      break;
    case "console":
      update(({ logs }) => ({ logs: [...logs, { level: event.level, text: event.text }] }));
      break;
  }
}

// A real server, in memory only
const connection = shallowRef<Connection>();
const connecting = ref(false);
const server = computed(() => {
  try {
    return connection.value && new URL(connection.value.sessionUrl).host;
  } catch {
    return connection.value?.sessionUrl;
  }
});

function run() {
  view.value = emptyView(code.value, "running");
  runner?.run(code.value, connection.value);
}

function connect(chosen: Connection) {
  connecting.value = false;
  connection.value = chosen;
  runner?.stop();
  // Results of a request-only run don't apply to the server
  view.value = emptyView(code.value, "ready");
}

function disconnect() {
  // Dropping the reference and the worker that held a copy forgets the credentials
  connection.value = undefined;
  runner?.stop();
  view.value = emptyView(code.value, "ready");
}

function onRunShortcut(event: KeyboardEvent) {
  if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return;
  event.preventDefault();
  event.stopPropagation();
  run();
}

const example = computed(() => findExample(code.value));

function chooseExample(id: string) {
  const chosen = examples.find((candidate) => candidate.id === id);
  if (!chosen || !editor) return;
  editor.setCode(chosen.code);
  if (!connection.value) run();
}

// Whether the code was edited since the last run
const stale = computed(() => view.value.code !== code.value);
const status = computed<RunStatus>(() => (stale.value ? "ready" : view.value.status));

// Where the method calls were made, while the code shown is the code that ran
const lines = computed(() => {
  const { source, trace, requests } = view.value;
  if (!source || !trace || stale.value) return undefined;
  const calls = buildTimeline(requests).flatMap((entry) =>
    entry.kind === "batch" ? entry.calls : [],
  );
  return sourceLines(source, trace, calls);
});

// Method calls hovered in the panel, and those under the pointer in the editor
const panelHovered = ref<string>();
const editorHovered = ref<string[]>([]);
const highlighted = computed(
  () => new Set([...editorHovered.value, ...(panelHovered.value ? [panelHovered.value] : [])]),
);
watch(code, () => {
  panelHovered.value = undefined;
  editorHovered.value = [];
});
watch([panelHovered, lines], ([label, current]) => {
  const range = label ? current?.calls[label] : undefined;
  editor?.highlight(range ? [{ from: range.start.line, to: range.end.line }] : []);
});

onMounted(async () => {
  addEventListener("keydown", onRunShortcut, true);
  const [{ createEditor }, { startTypeScriptWorker }] = await Promise.all([
    import("./editor.ts"),
    import("./ts-worker.ts"),
  ]);
  if (unmounted || !editorHost.value) return;
  const worker = startTypeScriptWorker();
  runner = createRunner((source) => worker.compile(source), onEvent);
  editor = createEditor(editorHost.value, {
    code: code.value,
    worker,
    onChange: (value) => (code.value = value),
    onHover: (position) => {
      editorHovered.value = position && lines.value ? labelsAt(lines.value, position) : [];
    },
  });
  run();
});

onBeforeUnmount(() => {
  unmounted = true;
  removeEventListener("keydown", onRunShortcut, true);
  connection.value = undefined;
  runner?.stop();
  editor?.destroy();
});
</script>

<template>
  <div class="playground">
    <div class="toolbar">
      <label class="example">
        Example
        <select
          :value="example?.id ?? ''"
          @change="chooseExample(($event.target as HTMLSelectElement).value)"
        >
          <option v-if="!example" value="" disabled>Your code</option>
          <option v-for="option in examples" :key="option.id" :value="option.id">
            {{ option.title }}
          </option>
        </select>
      </label>
      <button type="button" class="button run" @click="run">▶ Run <kbd>⌘↵</kbd></button>
      <span v-if="connection" class="connected">
        <strong>Connected</strong> · {{ server }}
        <button type="button" class="disconnect" @click="disconnect">Disconnect</button>
      </span>
      <button v-else type="button" class="button connect" @click="connecting = true">
        Connect a server…
      </button>
    </div>
    <ConnectDialog v-if="connecting" @connect="connect" @close="connecting = false" />
    <div class="panes">
      <section class="pane" aria-label="Code">
        <header class="pane-header">playground.ts</header>
        <div ref="editorHost" class="editor" />
      </section>

      <section class="pane" aria-label="Output">
        <header class="pane-header">Requests</header>
        <div class="output" aria-live="polite">
          <TimelinePanel
            :requests="view.requests"
            :responses="view.responses"
            :connected="server"
            :status="status"
            :errors="view.errors"
            :diagnostics="view.diagnostics"
            :logs="view.logs"
            :lines="lines"
            :highlighted="highlighted"
            @hover-call="panelHovered = $event"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.playground {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 16px 16px;
  min-height: calc(100vh - var(--vp-nav-height));
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  font-size: 14px;
}

.example {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--vp-c-text-2);
}

.example select {
  padding: 4px 28px 4px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg)
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23888' stroke-width='1.5'/%3E%3C/svg%3E")
    no-repeat right 10px center;
  appearance: none;
  color: var(--vp-c-text-1);
}

.button {
  padding: 4px 12px;
  border-radius: 8px;
  font-weight: 500;
}

.run {
  background: var(--vp-c-brand-1);
  color: var(--vp-c-white);
}

.run:hover {
  background: var(--vp-c-brand-2);
}

.run kbd {
  margin-left: 4px;
  font-family: inherit;
  font-size: 12px;
  opacity: 0.8;
}

.connect {
  margin-left: auto;
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
}

.connected {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.disconnect {
  padding: 2px 10px;
  border-radius: 8px;
  background: var(--vp-button-alt-bg);
  color: var(--vp-c-text-1);
  font-size: 12px;
}

.panes {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  min-height: 0;
}

@media (min-width: 960px) {
  .playground {
    height: calc(100vh - var(--vp-nav-height));
  }

  .panes {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}

.pane {
  display: flex;
  flex-direction: column;
  min-height: 320px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  overflow: hidden;
}

.pane-header {
  padding: 8px 12px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  font-size: 13px;
  font-weight: 600;
}

.editor {
  flex: 1;
  min-height: 320px;
  overflow: hidden;
}

.output {
  flex: 1;
  overflow: auto;
  padding: 12px;
}
</style>

<style>
/* CodeMirror, on the docs site's code colors; it renders outside this component's scope */
.playground .cm-editor {
  height: 100%;
  font-size: 14px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

.playground .cm-editor.cm-focused {
  outline: none;
}

.playground .cm-scroller {
  font-family: var(--vp-font-family-mono);
  line-height: 1.6;
}

.playground .cm-gutters {
  border-right: none;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-3);
}

.playground .cm-activeLine,
.playground .cm-activeLineGutter {
  background: transparent;
}

.playground .cm-content {
  caret-color: var(--vp-c-text-1);
}

.playground .pg-hovered-line {
  background: var(--vp-c-brand-soft);
  box-shadow: inset 3px 0 var(--vp-c-brand-1);
}

.playground .tok-keyword,
.playground .tok-operatorKeyword {
  color: var(--vp-c-brand-1);
}

.playground .tok-string,
.playground .tok-string2 {
  color: var(--vp-c-tip-1);
}

.playground .tok-number,
.playground .tok-bool {
  color: var(--vp-c-green-1);
}

.playground .tok-comment {
  color: var(--vp-c-text-3);
  font-style: italic;
}

.playground .tok-typeName,
.playground .tok-className {
  color: var(--vp-c-purple-1, var(--vp-c-indigo-1));
}

.playground .cm-tooltip {
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-elv);
  color: var(--vp-c-text-1);
}

.playground .cm-tooltip-autocomplete > ul > li[aria-selected] {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-text-1);
}
</style>
