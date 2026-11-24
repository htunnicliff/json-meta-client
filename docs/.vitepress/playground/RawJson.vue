<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, watch } from "vue";

import { annotateRequest, jsonLines } from "./timeline.ts";
import type { AnnotatedLine, BatchEntry, ResultLink, TokenKind } from "./timeline.ts";

const props = withDefaults(
  defineProps<{
    /** A JMAP Request, shown with lines joining its result references */
    batch?: BatchEntry;
    /** Any other JSON value, shown when there is no `batch` */
    body?: unknown;
    label: string;
    /** Labels of the method calls to highlight */
    highlighted?: ReadonlySet<string>;
    /** Whether to number the lines */
    lineNumbers?: boolean;
    /** Whether to draw lines from each method call to the references to its result */
    links?: boolean;
  }>(),
  { lineNumbers: true, links: true },
);

const emit = defineEmits<{ hoverCall: [label: string | undefined] }>();

const lines = computed<AnnotatedLine[]>(() =>
  props.batch ? annotateRequest(props.batch) : jsonLines(props.body),
);

// The editor's highlight classes, so both panes share one color scheme
const tokenClasses: Record<TokenKind, string> = {
  key: "tok-propertyName",
  string: "tok-string",
  number: "tok-number",
  literal: "tok-bool",
  punctuation: "tok-punctuation",
};

// Unique per instance, for the ids of arrowhead markers
const markerId = `arrow-${useId()}`;

/** How many colors connectors cycle through */
const PALETTE = 5;
/** The room each lane of connectors takes */
const LANE = 9;

const colorOf = (color: number | undefined) => `var(--link-${(color ?? 0) % PALETTE})`;

/** A reference to a method call's result: from the call's id down to the argument */
interface Connector {
  link: ResultLink;
  /** The line of the argument that refers */
  to: number;
}

/** The references to one method call's result, drawn as one trunk with a branch to each */
interface ConnectorGroup {
  /** The line of the call id referred to, or -1 when it is in an earlier Batch */
  from: number;
  connectors: Connector[];
  /** The last line the group reaches */
  end: number;
  lane: number;
  /** Differs from the color of every group whose lines overlap this one's */
  color: number;
}

// Group references by the call they refer to, then give each group a lane and
// a color that no group overlapping it has
const groups = computed((): ConnectorGroup[] => {
  if (!props.links) return [];
  const idLines = new Map<string, number>();
  lines.value.forEach(({ call, callId }, index) => {
    if (call && callId) idLines.set(call, index);
  });
  const byFrom = new Map<string, ConnectorGroup>();
  lines.value.forEach(({ link }, to) => {
    if (!link) return;
    const from = idLines.get(link.from.label) ?? -1;
    const key = `${from}:${link.from.label}`;
    const group = byFrom.get(key) ?? { from, connectors: [], end: to, lane: 0, color: 0 };
    group.connectors.push({ link, to });
    group.end = Math.max(group.end, to);
    byFrom.set(key, group);
  });
  const sorted = [...byFrom.values()].toSorted((a, b) => a.from - b.from || a.end - b.end);
  const laneEnds: number[] = [];
  sorted.forEach((group, index) => {
    let lane = laneEnds.findIndex((end) => end < group.from);
    if (lane === -1) lane = laneEnds.push(0) - 1;
    laneEnds[lane] = group.end;
    group.lane = lane;
    const taken = new Set(
      sorted
        .slice(0, index)
        .filter((other) => other.end >= group.from)
        .map(({ color }) => color),
    );
    const free = Array.from({ length: PALETTE }, (_, color) => color).find(
      (color) => !taken.has(color),
    );
    group.color = free ?? index % PALETTE;
  });
  return sorted;
});

const gutter = computed(() => {
  const lanes = Math.max(0, ...groups.value.map(({ lane }) => lane + 1));
  return lanes ? lanes * LANE + 10 : 0;
});

// Where each line's middle is, where the code starts and how wide a
// character is, measured once drawn
const root = ref<HTMLElement>();
const middles = ref<number[]>([]);
const codeLeft = ref(0);
const charWidth = ref(0);

async function measure() {
  await nextTick();
  const element = root.value;
  if (!element || !groups.value.length) return;
  const rows = [...element.querySelectorAll<HTMLElement>(":scope > .line")];
  middles.value = rows.map((row) => row.offsetTop + row.offsetHeight / 2);
  const texts = rows.flatMap((row) => row.querySelector<HTMLElement>(".text") ?? []);
  codeLeft.value = texts[0]?.offsetLeft ?? 0;
  const widest = texts.reduce<HTMLElement | undefined>(
    (best, text) => (text.textContent.length > (best?.textContent.length ?? 0) ? text : best),
    undefined,
  );
  // The width of the characters themselves, not of the column they sit in
  const length = widest?.textContent.length ?? 0;
  if (!widest || !length) return;
  const range = document.createRange();
  range.selectNodeContents(widest);
  charWidth.value = range.getBoundingClientRect().width / length;
}

onMounted(() => {
  void measure();
  void document.fonts?.ready.then(measure);
});
watch([lines, gutter], measure);

// Where the code of a line starts, past its indentation
function codeStart(index: number): number {
  const indent = /^ */.exec(lines.value[index]?.text ?? "")?.[0].length ?? 0;
  return gutter.value + indent * charWidth.value - 6;
}

function pathOf({ from, lane }: ConnectorGroup, { to }: Connector): string {
  const y1 = from === -1 ? 0 : middles.value[from];
  const y2 = middles.value[to];
  if (y1 === undefined || y2 === undefined) return "";
  const x = gutter.value - 9 - lane * LANE;
  const r = 4;
  const start =
    from === -1
      ? `M ${x} ${y1}`
      : `M ${codeStart(from)} ${y1} H ${x + r} Q ${x} ${y1} ${x} ${y1 + r}`;
  return `${start} V ${y2 - r} Q ${x} ${y2} ${x + r} ${y2} H ${codeStart(to)}`;
}

// The group under the pointer, and where to show its message
const hovered = ref<{ index: number; group: ConnectorGroup; x: number; y: number }>();

function hover(index: number, group: ConnectorGroup, event: MouseEvent) {
  const box = root.value?.getBoundingClientRect();
  if (!box || !root.value) return;
  hovered.value = {
    index,
    group,
    x: event.clientX - box.left + root.value.scrollLeft + 14,
    y: event.clientY - box.top + 14,
  };
}

function leave() {
  hovered.value = undefined;
}

// The lines at the ends of the hovered group's connectors
const ends = computed(() => {
  const group = hovered.value?.group;
  return new Set(group ? [group.from, ...group.connectors.map(({ to }) => to)] : []);
});
</script>

<template>
  <div
    ref="root"
    class="raw"
    :class="{ numbered: lineNumbers, linking: hovered }"
    :style="{ '--gutter': `${gutter}px` }"
    role="region"
    :aria-label="label"
  >
    <div
      v-for="(line, index) in lines"
      :key="index"
      class="line"
      :class="{
        highlighted: line.call && highlighted?.has(line.call),
        end: ends.has(index),
      }"
      :style="ends.has(index) ? { '--end': colorOf(hovered?.group.color) } : undefined"
      @mouseenter="emit('hoverCall', line.call)"
      @mouseleave="emit('hoverCall', undefined)"
    >
      <span v-if="lineNumbers" class="number">{{ index + 1 }}</span>
      <code class="text"
        ><span
          v-for="(token, tokenIndex) in line.tokens"
          :key="tokenIndex"
          :class="token.kind && tokenClasses[token.kind]"
          >{{ token.text }}</span
        ></code
      >
    </div>

    <svg
      v-if="groups.length"
      class="connectors"
      :style="{ left: `${codeLeft}px`, width: `${gutter}px` }"
      aria-hidden="true"
    >
      <defs>
        <marker
          v-for="index in PALETTE"
          :id="`${markerId}-${index - 1}`"
          :key="index"
          viewBox="0 0 6 6"
          refX="5"
          refY="3"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 z" :fill="colorOf(index - 1)" />
        </marker>
      </defs>
      <g
        v-for="(group, index) in groups"
        :key="index"
        class="connector"
        :class="{ active: hovered?.index === index }"
        :style="{ color: colorOf(group.color) }"
        @mousemove="hover(index, group, $event)"
        @mouseleave="leave"
      >
        <path
          v-for="connector in group.connectors"
          :key="`hit-${connector.to}`"
          :d="pathOf(group, connector)"
          class="hit"
        />
        <path
          v-for="connector in group.connectors"
          :key="connector.to"
          :d="pathOf(group, connector)"
          class="stroke"
          :marker-end="`url(#${markerId}-${group.color % PALETTE})`"
        />
        <circle
          v-if="group.from !== -1"
          :cx="codeStart(group.from)"
          :cy="middles[group.from]"
          r="2.5"
          fill="currentColor"
        />
      </g>
    </svg>

    <div
      v-if="hovered"
      class="message"
      :style="{ left: `${hovered.x}px`, top: `${hovered.y}px` }"
      role="tooltip"
    >
      <template v-if="hovered.group.connectors.length === 1">
        <p v-for="{ link } in hovered.group.connectors" :key="link.to.label">
          <code>{{ link.to.label }}</code> takes <code>{{ link.key }}</code> from
          <template v-if="link.path"><code>{{ link.path }}</code> of </template>
          <code>{{ link.from.label }}</code>
          <template v-if="hovered.group.from === -1"> in an earlier Batch</template>
        </p>
      </template>
      <template v-else>
        <p>
          <code>{{ hovered.group.connectors[0]?.link.from.label }}</code> feeds
          {{ hovered.group.connectors.length }} arguments<template v-if="hovered.group.from === -1">
            from an earlier Batch</template
          >:
        </p>
        <ul>
          <li v-for="{ link } in hovered.group.connectors" :key="`${link.to.label}${link.key}`">
            <code>{{ link.path ?? "/" }}</code> → <code>{{ link.to.label }}</code>
            <span class="key">{{ link.key }}</span>
          </li>
        </ul>
      </template>
      <p class="methods">
        {{ hovered.group.connectors[0]?.link.from.name ?? "An earlier call" }} →
        {{ [...new Set(hovered.group.connectors.map(({ link }) => link.to.name))].join(", ") }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.raw {
  --link-0: var(--vp-c-indigo-1);
  --link-1: var(--vp-c-green-1);
  --link-2: var(--vp-c-yellow-1);
  --link-3: var(--vp-c-purple-1);
  --link-4: var(--vp-c-red-1);
  position: relative;
  padding: 8px 0;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.6;
  overflow-x: auto;
}

.line {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 0 12px;
}

/* Like the editor's lines, highlights ease in and out as the pointer moves */
.line {
  transition: background-color 0.1s;
}

@media (prefers-reduced-motion: reduce) {
  .line {
    transition: none;
  }
}

.numbered .line {
  grid-template-columns: 3ch minmax(0, 1fr);
}

.line.highlighted {
  background: var(--vp-c-brand-soft);
}

/* The lines a hovered connector joins */
.line.end {
  background: color-mix(in srgb, var(--end) 14%, transparent);
}

.number {
  color: var(--vp-c-text-3);
  text-align: right;
  user-select: none;
}

.text {
  padding-left: var(--gutter);
  white-space: pre;
  color: var(--vp-c-text-1);
}

.connectors {
  position: absolute;
  top: 0;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.connector {
  pointer-events: auto;
  cursor: default;
  transition: opacity 0.15s;
}

.linking .connector:not(.active) {
  opacity: 0.3;
}

.hit {
  fill: none;
  stroke: transparent;
  stroke-width: 10;
}

.stroke {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  /* Zero-length dashes with round caps draw as dots */
  stroke-dasharray: 0 4;
  stroke-linecap: round;
}

.active .stroke {
  stroke-width: 2;
  stroke-dasharray: none;
}

.message {
  position: absolute;
  z-index: 1;
  max-width: 44ch;
  padding: 6px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-elv);
  box-shadow: var(--vp-shadow-2);
  font-family: var(--vp-font-family-base);
  font-size: 12px;
  line-height: 1.5;
  pointer-events: none;
}

.message p,
.message ul {
  margin: 0;
}

.message ul {
  padding: 0;
  list-style: none;
}

.message li {
  white-space: nowrap;
}

.message .key {
  margin-left: 0.4em;
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono);
}

.message code {
  font-family: var(--vp-font-family-mono);
  font-weight: 600;
}

.methods {
  color: var(--vp-c-text-2);
}
</style>
