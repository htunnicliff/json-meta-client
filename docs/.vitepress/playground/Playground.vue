<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";

import type { RecordedRequest, RecordedResponse } from "../recorder/index.ts";
import { PLACEHOLDER_ORIGIN } from "../recorder/placeholders.ts";
import { readCodeLink } from "./code-link.ts";
import { codeOptions } from "./code-options.ts";
import { loadCode, saveCode } from "./code-storage.ts";
import ConnectDialog from "./ConnectDialog.vue";
import { forgetConnection, loadConnection, saveConnection } from "./connection-storage.ts";
import ConsolePanel from "./ConsolePanel.vue";
import type { ConsoleLine } from "./ConsolePanel.vue";
import DisconnectDialog from "./DisconnectDialog.vue";
import type { CodeEditor } from "./editor.ts";
import { examples, findExample } from "./examples.ts";
import type { SourceInfo } from "./instrument.ts";
import OptionsMenu from "./OptionsMenu.vue";
import type { Connection, Diagnostic, HookRun } from "./protocol.ts";
import { createRunner } from "./runner.ts";
import type { Runner, RunnerEvent } from "./runner.ts";
import { labelsAt, sourceLines } from "./source-lines.ts";
import { loadOptions, saveOptions } from "./stored-options.ts";
import { timelineOptions } from "./timeline-options.ts";
import { buildTimeline } from "./timeline.ts";
import type { RunStatus } from "./timeline.ts";
import TimelinePanel from "./TimelinePanel.vue";
import type { Trace } from "./tracer.ts";

/**
 * What the panel shows of a run
 */
interface RunView {
  requests: RecordedRequest[];
  requestOperations: (number | undefined)[];
  hookRuns: ReadonlyMap<number, HookRun>;
  diagnostics: Diagnostic[];
  errors: string[];
  logs: ConsoleLine[];
  /** Responses by request index: placeholder Sessions, and those from a connected server */
  responses: (RecordedResponse | undefined)[];
  status: RunStatus;
  /** The code the run ran */
  code: string;
  source?: SourceInfo;
  trace?: Trace;
}

const emptyView = (code: string, status: RunStatus): RunView => ({
  requests: [],
  requestOperations: [],
  hookRuns: new Map(),
  diagnostics: [],
  errors: [],
  logs: [],
  responses: [],
  status,
  code,
});

const code = ref(loadCode());
watch(code, saveCode);
const view = shallowRef<RunView>(emptyView(code.value, "ready"));
const editorHost = ref<HTMLElement>();
const shownInTimeline = ref(loadOptions(timelineOptions));
watch(shownInTimeline, (chosen) => saveOptions(timelineOptions, chosen));
const codeChoices = ref(loadOptions(codeOptions));

// The console's share of the column it shares with the code, on wide screens
const CONSOLE_SHARE_KEY = "json-meta-client:playground:console-share";
const DEFAULT_CONSOLE_SHARE = 0.25;
const MIN_CONSOLE_SHARE = 0.1;
const MAX_CONSOLE_SHARE = 0.75;
const clampShare = (share: number) =>
  Math.min(MAX_CONSOLE_SHARE, Math.max(MIN_CONSOLE_SHARE, share));

function loadConsoleShare(): number {
  try {
    const stored = Number(localStorage.getItem(CONSOLE_SHARE_KEY));
    return stored ? clampShare(stored) : DEFAULT_CONSOLE_SHARE;
  } catch {
    return DEFAULT_CONSOLE_SHARE;
  }
}

const consoleShare = ref(loadConsoleShare());
watch(consoleShare, (share) => {
  try {
    localStorage.setItem(CONSOLE_SHARE_KEY, String(share));
  } catch {
    // Storage can be unavailable; the size lasts the visit
  }
});
const codePane = ref<HTMLElement>();

// Editable text always matches :focus-visible, so the editor's ring follows
// how focus arrived instead: a pointer press just before focus means a click
const editorKeyboardFocus = ref(false);
let pointerPressed = false;

function onEditorFocusIn(event: FocusEvent) {
  if ((event.target as Element).classList.contains("cm-content")) {
    editorKeyboardFocus.value = !pointerPressed;
  }
  pointerPressed = false;
}
const consolePane = ref<HTMLElement>();
const resizing = ref(false);

// Drag the handle between the code and the console to share the column
function startResize(event: PointerEvent) {
  if (event.button !== 0 || !codePane.value || !consolePane.value) return;
  event.preventDefault();
  const handle = event.currentTarget as HTMLElement;
  const top = codePane.value.getBoundingClientRect().top;
  const bottom = consolePane.value.getBoundingClientRect().bottom;
  const room = bottom - top - handle.offsetHeight;
  if (room <= 0) return;
  handle.setPointerCapture(event.pointerId);
  resizing.value = true;
  const move = (moved: PointerEvent) => {
    consoleShare.value = clampShare((bottom - moved.clientY - handle.offsetHeight / 2) / room);
  };
  const end = () => {
    resizing.value = false;
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", end);
    handle.removeEventListener("pointercancel", end);
  };
  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
}

// Arrow keys move the handle; Home and End go to the limits
function resizeByKey(event: KeyboardEvent) {
  const step = event.shiftKey ? 0.1 : 0.05;
  const next: Record<string, number> = {
    ArrowUp: consoleShare.value + step,
    ArrowDown: consoleShare.value - step,
    Home: MAX_CONSOLE_SHARE,
    End: MIN_CONSOLE_SHARE,
  };
  if (!(event.key in next)) return;
  event.preventDefault();
  consoleShare.value = clampShare(next[event.key]!);
}
watch(codeChoices, (chosen) => {
  saveOptions(codeOptions, chosen);
  editor?.configure(chosen);
});
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
      update(({ requests, requestOperations }) => {
        const nextRequests = [...requests];
        const nextOperations = [...requestOperations];
        nextRequests[event.index] = event.request;
        nextOperations[event.index] = event.operation;
        return { requests: nextRequests, requestOperations: nextOperations };
      });
      break;
    case "hook":
      update(({ hookRuns }) => {
        const next = new Map(hookRuns);
        const calls = [...(next.get(event.operation)?.calls ?? [])];
        const previous = calls.findIndex(
          ({ name, position }) => name === event.call.name && position === event.call.position,
        );
        calls[previous < 0 ? calls.length : previous] = event.call;
        next.set(event.operation, { target: event.target, calls });
        return { hookRuns: next };
      });
      break;
    case "idle":
      update(({ status }) => ({
        status: status === "failed" ? status : event.finished ? "finished" : "waiting",
      }));
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

// A real server: in memory only, unless the user chose to remember it
const connection = shallowRef<Connection | undefined>(loadConnection());
const remembered = ref(connection.value !== undefined);
const connecting = ref(false);
const confirmingDisconnect = ref(false);
const server = computed(() => {
  try {
    return connection.value && new URL(connection.value.sessionUrl).host;
  } catch {
    return connection.value?.sessionUrl;
  }
});
// Where `<server>` points without a connection
const mockedServer = new URL(PLACEHOLDER_ORIGIN).host;

// Show in the editor what fills in the code's placeholders
function showPlaceholderFill() {
  const current = connection.value;
  editor?.setPlaceholderFill(
    current && {
      sessionUrl: current.sessionUrl,
      authMethod: typeof current.auth === "string" ? "bearer" : "basic",
    },
  );
}
watch(connection, showPlaceholderFill);

function formatNow() {
  void editor?.format();
}

/**
 * Run the code, formatting it first when the user runs it and chose to
 */
async function run({ byUser = true } = {}) {
  if (byUser && codeChoices.value.formatOnRun) await editor?.format();
  view.value = emptyView(code.value, "running");
  runner?.run(code.value, connection.value);
}

function connect(chosen: Connection, remember: boolean) {
  connecting.value = false;
  connection.value = chosen;
  remembered.value = remember;
  if (remember) saveConnection(chosen);
  else forgetConnection();
  runner?.stop();
  // Results of a request-only run don't apply to the server
  view.value = emptyView(code.value, "ready");
}

function disconnect() {
  confirmingDisconnect.value = false;
  // Dropping the reference and the worker that held a copy forgets the credentials
  connection.value = undefined;
  remembered.value = false;
  forgetConnection();
  runner?.stop();
  view.value = emptyView(code.value, "ready");
}

function onRunShortcut(event: KeyboardEvent) {
  if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return;
  event.preventDefault();
  event.stopPropagation();
  void run();
}

const example = computed(() => findExample(code.value));

function chooseExample(id: string) {
  const chosen = examples.find((candidate) => candidate.id === id);
  if (!chosen || !editor) return;
  editor.setCode(chosen.code);
  if (!connection.value) void run({ byUser: false });
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
  const [{ createEditor }, { startTypeScriptWorker }, linked] = await Promise.all([
    import("./editor.ts"),
    import("./ts-worker.ts"),
    readCodeLink(location.hash),
  ]);
  if (unmounted || !editorHost.value) return;
  // Code opened from a docs example replaces the stored code, and the link
  // leaves the address bar, so a reload keeps any edits made since
  if (linked !== undefined) {
    code.value = linked;
    history.replaceState(history.state, "", location.pathname + location.search);
  }
  const worker = startTypeScriptWorker();
  runner = createRunner((source) => worker.compile(source), onEvent);
  editor = createEditor(editorHost.value, {
    code: code.value,
    behavior: codeChoices.value,
    worker,
    onChange: (value) => (code.value = value),
    onHover: (position) => {
      editorHovered.value = position && lines.value ? labelsAt(lines.value, position) : [];
    },
  });
  showPlaceholderFill();
  // Code runs against a real server only when the user asks
  if (!connection.value) void run({ byUser: false });
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
          name="example"
          autocomplete="off"
          data-1p-ignore
          :value="example?.id ?? ''"
          @change="chooseExample(($event.target as HTMLSelectElement).value)"
        >
          <option v-if="!example" value="" disabled>Your code</option>
          <option v-for="option in examples" :key="option.id" :value="option.id">
            {{ option.title }}
          </option>
        </select>
      </label>
      <!-- Icons from Lucide (ISC license): play, plug and unplug -->
      <button
        type="button"
        class="button run"
        aria-keyshortcuts="Meta+Enter Control+Enter"
        @click="run()"
      >
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 3l14 9-14 9Z" fill="currentColor" />
        </svg>
        Run <kbd aria-hidden="true">⌘↵</kbd>
      </button>
      <div class="connection">
        <span
          v-if="connection"
          class="status"
          data-state="connected"
          title="Fills in <server> and <credentials>"
        >
          <strong>Connected</strong> · {{ server }}
          <span class="visually-hidden">. Fills in &lt;server&gt; and &lt;credentials&gt;</span>
        </span>
        <span
          v-else
          class="status"
          data-state="mocked"
          title="Placeholder Session; method calls go unanswered"
        >
          <strong>Mocked</strong> · {{ mockedServer }}
          <span class="visually-hidden">. Placeholder Session; method calls go unanswered</span>
        </span>
        <button
          v-if="connection"
          type="button"
          class="button secondary"
          @click="confirmingDisconnect = true"
        >
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m19 5 3-3" />
            <path d="m2 22 3-3" />
            <path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z" />
            <path d="M7.5 13.5 10 11" />
            <path d="M10.5 16.5 13 14" />
            <path d="m12 6 6 6 2.3-2.3a2.4 2.4 0 0 0 0-3.4l-2.6-2.6a2.4 2.4 0 0 0-3.4 0Z" />
          </svg>
          Disconnect
        </button>
        <button v-else type="button" class="button secondary" @click="connecting = true">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 22v-5" />
            <path d="M9 8V2" />
            <path d="M15 8V2" />
            <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
          </svg>
          Connect a server…
        </button>
      </div>
    </div>
    <ConnectDialog v-if="connecting" @connect="connect" @close="connecting = false" />
    <DisconnectDialog
      v-if="confirmingDisconnect"
      :server="server"
      :remembered="remembered"
      @disconnect="disconnect"
      @close="confirmingDisconnect = false"
    />
    <div
      class="panes"
      :class="{ resizing }"
      :style="{ '--code-share': `${1 - consoleShare}fr`, '--console-share': `${consoleShare}fr` }"
    >
      <section
        ref="codePane"
        class="pane code-pane"
        :class="{ 'keyboard-focus': editorKeyboardFocus }"
        aria-label="Code"
        @pointerdown="pointerPressed = true"
        @focusin="onEditorFocusIn"
        @focusout="editorKeyboardFocus = false"
      >
        <header class="pane-header">
          playground.ts
          <OptionsMenu v-model="codeChoices" :set="codeOptions" title="Editor">
            <template #actions="{ close }">
              <button
                type="button"
                aria-keyshortcuts="Shift+Alt+F"
                @click="
                  close();
                  formatNow();
                "
              >
                Format now <kbd aria-hidden="true">⇧⌥F</kbd>
              </button>
            </template>
          </OptionsMenu>
        </header>
        <div ref="editorHost" class="editor" />
      </section>

      <section class="pane requests-pane" aria-label="Output">
        <header class="pane-header">
          Requests
          <OptionsMenu v-model="shownInTimeline" :set="timelineOptions" title="Timeline" />
        </header>
        <div class="output">
          <TimelinePanel
            :requests="view.requests"
            :request-operations="view.requestOperations"
            :hook-runs="view.hookRuns"
            :responses="view.responses"
            :connected="server"
            :status="status"
            :errors="view.errors"
            :diagnostics="view.diagnostics"
            :lines="lines"
            :highlighted="highlighted"
            :options="shownInTimeline"
            @hover-call="panelHovered = $event"
          />
        </div>
      </section>

      <div
        class="split"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Console height"
        aria-valuemin="10"
        aria-valuemax="75"
        :aria-valuenow="Math.round(consoleShare * 100)"
        tabindex="0"
        title="Drag to resize; double-click to reset"
        @pointerdown="startResize"
        @keydown="resizeByKey"
        @dblclick="consoleShare = DEFAULT_CONSOLE_SHARE"
      />

      <section ref="consolePane" class="pane console-pane" aria-label="Console">
        <header class="pane-header">
          Console
          <span v-if="view.logs.length" class="count">{{ view.logs.length }}</span>
        </header>
        <div class="output">
          <ConsolePanel :logs="view.logs" />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* As wide as the nav bar's content, centered on wide screens */
.playground {
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
  width: 100%;
  max-width: var(--vp-layout-max-width);
  margin: 0 auto;
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

/* Every control in the toolbar is one height, with one corner radius */
.example select,
.button {
  box-sizing: border-box;
  height: 32px;
  border-radius: 8px;
  font-size: 14px;
}

.example select {
  padding: 0 28px 0 10px;
  border: 1px solid var(--site-c-control-border);
  border-radius: 8px;
  background: var(--vp-c-bg)
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23888' stroke-width='1.5'/%3E%3C/svg%3E")
    no-repeat right 10px center;
  appearance: none;
  color: var(--vp-c-text-1);
}

.button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid transparent;
  font-weight: 500;
  white-space: nowrap;
  transition:
    border-color 0.25s,
    background-color 0.25s;
}

.icon {
  flex: none;
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Like the site's brand buttons, which keep white text readable in both modes */
.run {
  background: var(--vp-button-brand-bg);
  color: var(--vp-button-brand-text);
}

.run .icon {
  width: 12px;
  height: 12px;
  stroke-width: 0;
}

.run:hover {
  background: var(--vp-button-brand-hover-bg);
  color: var(--vp-button-brand-hover-text);
}

.run:active {
  background: var(--vp-button-brand-active-bg);
  color: var(--vp-button-brand-active-text);
}

.run kbd {
  font-family: inherit;
  font-size: 12px;
  opacity: 0.8;
}

/* Like the site's alt buttons, such as those on the home page */
.secondary {
  border-color: var(--vp-button-alt-border);
  background: var(--vp-button-alt-bg);
  color: var(--vp-button-alt-text);
}

.secondary:hover {
  border-color: var(--vp-button-alt-hover-border);
  background: var(--vp-button-alt-hover-bg);
  color: var(--vp-button-alt-hover-text);
}

.connection {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  margin-left: auto;
}

/* A dot before the state: green for a server, amber like the Mocked badge for mocks */
.status::before {
  content: "";
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 6px;
  border-radius: 50%;
  background: var(--vp-c-green-1);
  vertical-align: 1px;
}

.status[data-state="mocked"]::before {
  background: var(--vp-c-warning-1);
}

.status[data-state="mocked"] {
  cursor: help;
}

.status {
  overflow: hidden;
  font-size: 13px;
  color: var(--vp-c-text-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Narrow: code, requests, console. Wide: the console under the code, the requests beside both. */
.panes {
  display: grid;
  flex: 1;
  grid-template-areas: "code" "requests" "console";
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  min-height: 0;
}

.code-pane {
  grid-area: code;
}

.requests-pane {
  grid-area: requests;
}

.console-pane {
  grid-area: console;
}

@media (min-width: 960px) {
  .playground {
    height: calc(100vh - var(--vp-nav-height));
    padding-inline: 32px;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 40px;
  padding: 0 8px 0 12px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  font-size: 13px;
  font-weight: 600;
}

.count {
  min-width: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-2);
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  text-align: center;
}

/* Short and scrolling, so the code and requests keep the room */
.console-pane {
  flex: none;
  min-height: 0;
  height: clamp(96px, 22vh, 240px);
}

.editor {
  flex: 1;
  min-height: 320px;
  overflow: hidden;
}

/* A column, so a lone message can center itself in the pane */
.output {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: auto;
  padding: 12px;
}

.split {
  display: none;
}

/*
 * Wide: the code and the console share the left column, split by a handle
 * in the gap between them that moves the split
 */
@media (min-width: 960px) {
  .panes {
    grid-template-areas:
      "code requests"
      "split requests"
      "console requests";
    grid-template-rows: minmax(0, var(--code-share)) 16px minmax(0, var(--console-share));
    row-gap: 0;
  }

  .code-pane,
  .console-pane,
  .editor {
    min-height: 0;
  }

  .console-pane {
    height: auto;
  }

  .split {
    display: grid;
    grid-area: split;
    place-items: center;
    cursor: row-resize;
    touch-action: none;
  }

  .split::after {
    content: "";
    width: 32px;
    height: 4px;
    border-radius: 2px;
    background: var(--site-c-control-border);
    transition: background-color 0.15s;
  }

  .split:hover::after,
  .split:focus-visible::after,
  .resizing .split::after {
    background: var(--vp-c-brand-1);
  }

  /* The handle is small, so a ring around it shows focus */
  .split:focus-visible {
    outline: none;
  }

  .split:focus-visible::after {
    outline: 2px solid var(--vp-c-brand-1);
    outline-offset: 2px;
  }

  .resizing {
    cursor: row-resize;
    user-select: none;
  }
}
</style>

<style>
/*
 * Inline code in prose, as on the docs pages. VitePress styles it only
 * inside `.vp-doc`, which the `page` layout leaves out. Code with a class,
 * such as a request's method and URL, has its own styles.
 */
.playground :not(pre) > code:not([class]) {
  border-radius: 4px;
  padding: 3px 6px;
  background-color: var(--vp-code-bg);
  color: var(--vp-code-color);
  font-size: var(--vp-code-font-size);
  unicode-bidi: plaintext;
}

/* CodeMirror, on the docs site's code colors; it renders outside this component's scope */
.playground .cm-editor {
  height: 100%;
  font-size: 14px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

/* The pane shows keyboard focus, so the editor needs no outline of its own */
.playground .cm-editor.cm-focused {
  outline: none;
}

.playground .code-pane.keyboard-focus {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -1px;
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

/* `<server>` and `<credentials>`, and what fills them in */
.playground .pg-placeholder {
  text-decoration: underline dotted var(--vp-c-warning-1);
  text-underline-offset: 3px;
  cursor: help;
}

.playground .pg-fill {
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--vp-c-tip-soft);
  color: var(--vp-c-tip-1);
  font-family: var(--vp-font-family-base);
  font-size: 12px;
  cursor: help;
}

/* Code that never runs without a server, and why */
.playground .pg-unreached-line {
  opacity: 0.5;
}

.playground .pg-await-note {
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--vp-c-warning-soft);
  color: var(--vp-c-warning-1);
  font-family: var(--vp-font-family-base);
  font-size: 12px;
  cursor: help;
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

/* JSON in the output pane: keys stay plain, punctuation recedes */
.playground .raw .tok-punctuation {
  color: var(--vp-c-text-2);
}

.playground .tok-comment {
  color: var(--vp-c-text-2);
  font-style: italic;
}

.playground .tok-typeName,
.playground .tok-className {
  color: var(--vp-c-purple-1, var(--vp-c-indigo-1));
}

/* Tooltips float like the site's other menus */
.playground .cm-tooltip {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-elv);
  box-shadow: var(--vp-shadow-3);
  color: var(--vp-c-text-1);
}

/*
 * The completion menu, like the options menu: padded, with rounded rows.
 * Tooltips render inside the editor, and `.cm-editor` outranks CodeMirror's
 * own theme.
 */
.playground .cm-editor .cm-tooltip.cm-tooltip-autocomplete > ul {
  min-width: 220px;
  max-height: 15em;
  padding: 4px;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  scrollbar-width: thin;
  scrollbar-color: var(--vp-c-divider) transparent;
}

.playground .cm-editor .cm-tooltip.cm-tooltip-autocomplete > ul > li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 8px 3px 4px;
  border-radius: 6px;
  line-height: 20px;
}

.playground .cm-editor .cm-tooltip.cm-tooltip-autocomplete > ul > li:hover {
  background: var(--vp-c-default-soft);
}

.playground .cm-editor .cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected] {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-text-1);
}

.playground .cm-editor .cm-completionMatchedText {
  color: var(--vp-c-brand-1);
  font-weight: 600;
  text-decoration: none;
}

.playground .cm-editor .cm-completionDetail {
  margin-left: auto;
  padding-left: 16px;
  color: var(--vp-c-text-2);
  font-style: normal;
}

/* Each kind as a letter on a tinted badge, in the editor's token colors */
.playground .cm-editor .cm-completionIcon {
  --kind: var(--vp-c-text-2);
  display: grid;
  flex: none;
  place-items: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border-radius: 4px;
  background: color-mix(in srgb, var(--kind) 14%, transparent);
  color: var(--kind);
  font-family: var(--vp-font-family-base);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  opacity: 1;
}

.playground .cm-editor .cm-completionIcon::after {
  content: var(--letter, "·");
}

.playground .cm-editor .cm-completionIcon-function,
.playground .cm-editor .cm-completionIcon-method {
  --kind: var(--vp-c-brand-1);
}

.playground .cm-editor .cm-completionIcon-function {
  --letter: "f";
}

.playground .cm-editor .cm-completionIcon-method {
  --letter: "m";
}

.playground .cm-editor .cm-completionIcon-property {
  --kind: var(--vp-c-tip-1);
  --letter: "p";
}

.playground .cm-editor .cm-completionIcon-variable {
  --kind: var(--vp-c-tip-1);
  --letter: "v";
}

.playground .cm-editor .cm-completionIcon-constant {
  --kind: var(--vp-c-green-1);
  --letter: "c";
}

.playground .cm-editor .cm-completionIcon-class,
.playground .cm-editor .cm-completionIcon-interface,
.playground .cm-editor .cm-completionIcon-type,
.playground .cm-editor .cm-completionIcon-enum {
  --kind: var(--vp-c-purple-1, var(--vp-c-indigo-1));
}

.playground .cm-editor .cm-completionIcon-class {
  --letter: "C";
}

.playground .cm-editor .cm-completionIcon-interface {
  --letter: "I";
}

.playground .cm-editor .cm-completionIcon-type {
  --letter: "T";
}

.playground .cm-editor .cm-completionIcon-enum {
  --letter: "E";
}

.playground .cm-editor .cm-completionIcon-namespace {
  --letter: "N";
}

.playground .cm-editor .cm-completionIcon-keyword {
  --letter: "k";
}

.playground .cm-editor .cm-completionIcon-text {
  --letter: "t";
}

/*
 * Type information on hover: the signature as code, kept to a scrolling panel.
 * CodeMirror sets the tooltip's height to the room it has; the cap and the
 * column keep the frame to the content.
 */
.playground .cm-editor .cm-tooltip.cm-tooltip-hover {
  display: flex;
  flex-direction: column;
  max-height: 320px;
}

.playground .cm-editor .cm-tooltip-hover .cm-tooltip-section {
  min-height: 0;
  max-width: min(560px, 90vw);
  overflow: auto;
  padding: 8px 12px;
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  scrollbar-width: thin;
  scrollbar-color: var(--vp-c-divider) transparent;
}

.playground .cm-editor .cm-tooltip-hover .quick-info-keyword {
  color: var(--vp-c-brand-1);
}

.playground .cm-editor .cm-tooltip-hover .quick-info-className,
.playground .cm-editor .cm-tooltip-hover .quick-info-interfaceName,
.playground .cm-editor .cm-tooltip-hover .quick-info-typeParameterName,
.playground .cm-editor .cm-tooltip-hover .quick-info-enumName,
.playground .cm-editor .cm-tooltip-hover .quick-info-aliasName {
  color: var(--vp-c-purple-1, var(--vp-c-indigo-1));
}

.playground .cm-editor .cm-tooltip-hover .quick-info-stringLiteral {
  color: var(--vp-c-tip-1);
}

.playground .cm-editor .cm-tooltip-hover .quick-info-numericLiteral {
  color: var(--vp-c-green-1);
}

/* Punctuation and labels such as `(property)` recede behind the names */
.playground .cm-editor .cm-tooltip-hover .quick-info-punctuation,
.playground .cm-editor .cm-tooltip-hover .quick-info-operator,
.playground .cm-editor .cm-tooltip-hover .quick-info-moduleName {
  color: var(--vp-c-text-2);
}

.playground .cm-editor .cm-tooltip-hover .quick-info-text {
  color: var(--vp-c-text-2);
}

/* Documentation beside the menu */
.playground .cm-editor .cm-tooltip.cm-completionInfo {
  padding: 8px 12px;
  color: var(--vp-c-text-2);
  font-size: 13px;
  line-height: 1.5;
}
</style>
