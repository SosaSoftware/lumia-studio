<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { legacyFlow, parseFlowchart } from '@lumia/packages/catalog';
import type { FlowLink, FlowModel, NodeShape } from '@lumia/packages/catalog';
import { list, rec, str } from '../../api/decode.ts';
import { linkElements } from './arrow-geometry.ts';
import type { Box, Point, RouteStyle } from './arrow-geometry.ts';
import { useBoxSize } from './box-size.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { layerGraph, ringGraph } from './graph-layout.ts';
import { useMotion } from './motion.ts';
import { uniqueId } from './render-helpers.ts';
import { colorKey, fillVars, vividColor } from './tone.ts';

interface DrawnNode {
  id: string;
  text: string;
  shape: NodeShape;
  box: Box;
  layer: number;
  index: number;
}

interface DrawnLink {
  key: string;
  path: string;
  label: string;
  at: Point;
  dash: string | undefined;
  width: number;
  arrow: boolean;
  delay: number;
}

const props = defineProps<CatalogComponentProps>();
const { live } = useMotion(props);
const root = ref<HTMLElement | null>(null);
const measured = useBoxSize(root);
const markerId = uniqueId('diagram-head');

/**
 * The diagram is drawn only after the frame has been measured: a provisional size taller than the real frame would
 * overflow it and the editor would grow the frame to fit. Where there is no layout at all (unit tests), a 640 × 360
 * frame stands in.
 */
const ready = ref(false);
onMounted(() => {
  ready.value = true;
});
const W = computed(() => (measured.width.value > 0 ? measured.width.value : 640));
const H = computed(() => (measured.height.value > 0 ? measured.height.value : 360));
const unit = computed(() => (measured.width.value > 0 ? measured.unit.value : 6.4));
const animated = computed(() => live.value && props.data.animated !== false);
const kind = computed(() => str(props.data.kind, 'flow'));

/** The diagram as text, or, for diagrams made before it was text, the nodes and edges they were saved with. */
const model = computed<FlowModel>(() => {
  const code = str(props.data.code);
  if (code.trim() !== '') return parseFlowchart(code).model;
  return legacyFlow(
    list(props.data.nodes).map((item) => ({ id: str(rec(item).id), text: str(rec(item).text) })),
    list(props.data.edges).map((item) => ({ from: str(rec(item).from), to: str(rec(item).to) })),
  );
});

/** Pixel size of a node: it shrinks with the number of layers and nodes, within what stays legible. */
function nodeSize(layers: number, breadth: number, vertical: boolean): { w: number; h: number } {
  const u = unit.value;
  const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));
  if (kind.value === 'cycle') return { w: clamp(W.value * 0.24, 9 * u, 22 * u), h: 6.4 * u };
  const across = vertical ? W.value / breadth : H.value / breadth;
  const along = vertical ? H.value / layers : W.value / layers;
  return vertical ? { w: clamp(across * 0.8, 9 * u, 26 * u), h: clamp(along * 0.6, 4.6 * u, 7.5 * u) } : { w: clamp(along * 0.68, 9 * u, 24 * u), h: clamp(across * 0.7, 4.6 * u, 7.5 * u) };
}

const SCALE: Readonly<Record<NodeShape, { w: number; h: number }>> = {
  rect: { w: 1, h: 1 },
  round: { w: 1, h: 1 },
  stadium: { w: 1, h: 1 },
  circle: { w: 1, h: 1.25 },
  diamond: { w: 1.3, h: 1.7 },
};

/** Hierarchies always read top to bottom; a flow follows the first line of its text (`flowchart LR` or `TD`). */
const isVertical = computed(() => kind.value === 'hierarchy' || (kind.value === 'flow' && model.value.direction === 'TD'));

const drawn = computed(() => {
  const vertical = isVertical.value;
  const layout = kind.value === 'cycle' ? { nodes: ringGraph(model.value), back: new Set<number>(), layers: model.value.nodes.length, breadth: 1 } : layerGraph(model.value, vertical ? 'TD' : 'LR');
  const size = nodeSize(layout.layers, layout.breadth, vertical);
  const byId = new Map(model.value.nodes.map((node, index) => [node.id, { node, index }]));
  const nodes: DrawnNode[] = [];
  for (const placed of layout.nodes) {
    const entry = byId.get(placed.id);
    if (entry === undefined) continue;
    const scale = SCALE[entry.node.shape];
    const w = size.w * scale.w;
    const h = size.h * scale.h;
    nodes.push({ id: placed.id, text: entry.node.text, shape: entry.node.shape, box: { x: placed.x * W.value - w / 2, y: placed.y * H.value - h / 2, w, h }, layer: placed.layer, index: entry.index });
  }
  return { nodes, back: layout.back, size };
});

const boxes = computed(() => new Map(drawn.value.nodes.map((node) => [node.id, node])));
const stroke = computed(() => Math.max(0.8, unit.value * 0.22));

/** Path of a link that returns to an earlier node: it leaves and arrives through the same side and loops around. */
function loopPath(from: Box, to: Box, vertical: boolean, head: number): { path: string; at: Point } {
  const reach = Math.max(from.h, to.h) * 1.5;
  if (vertical) {
    const a = { x: from.x + from.w, y: from.y + from.h / 2 };
    const b = { x: to.x + to.w + head, y: to.y + to.h / 2 };
    return { path: `M${String(a.x)} ${String(a.y)} C${String(a.x + reach)} ${String(a.y)} ${String(b.x + reach)} ${String(b.y)} ${String(b.x)} ${String(b.y)}`, at: { x: Math.max(a.x, b.x) + reach * 0.75, y: (a.y + b.y) / 2 } };
  }
  const a = { x: from.x + from.w / 2, y: from.y + from.h };
  const b = { x: to.x + to.w / 2, y: to.y + to.h + head };
  return { path: `M${String(a.x)} ${String(a.y)} C${String(a.x)} ${String(a.y + reach)} ${String(b.x)} ${String(b.y + reach)} ${String(b.x)} ${String(b.y)}`, at: { x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) + reach * 0.75 } };
}

const links = computed<DrawnLink[]>(() => {
  const vertical = isVertical.value;
  const routeStyle: RouteStyle = kind.value === 'hierarchy' ? 'elbow' : 'curved';
  const head = stroke.value * 1.6;
  const result: DrawnLink[] = [];
  model.value.links.forEach((link: FlowLink, position) => {
    const from = boxes.value.get(link.from);
    const to = boxes.value.get(link.to);
    if (from === undefined || to === undefined) return;
    const width = link.line === 'thick' ? stroke.value * 1.9 : stroke.value;
    const dash = link.line === 'dotted' ? `${String(width * 1.2)} ${String(width * 2.2)}` : undefined;
    const delay = 0.25 + Math.max(from.layer, 0) * 0.12 + 0.1;
    const base = { key: `${String(position)}-${link.from}-${link.to}`, label: link.label, dash, width, arrow: link.arrow, delay };
    if (link.from === link.to || (drawn.value.back.has(position) && kind.value !== 'cycle')) {
      const loop = loopPath(from.box, to.box, vertical, link.arrow ? head : 0);
      result.push({ ...base, path: loop.path, at: loop.at });
      return;
    }
    const route = linkElements(from.box, to.box, 'auto', 'auto', routeStyle, 0.4 * unit.value, 0, link.arrow ? head : 0);
    result.push({ ...base, path: route.path, at: { x: (route.from.x + route.to.x) / 2, y: (route.from.y + route.to.y) / 2 } });
  });
  return result;
});

/** Paint of a node: its own vivid color when the diagram is colorful, the diagram color otherwise. */
function nodeStyle(node: DrawnNode): Record<string, string> {
  const color = props.data.colorful === true ? vividColor(node.index) : colorKey(props.data.color, 'primary');
  const { box } = node;
  return {
    ...fillVars(color, props.data.variant ?? 'soft'),
    left: `${String(box.x)}px`,
    top: `${String(box.y)}px`,
    width: `${String(box.w)}px`,
    height: `${String(box.h)}px`,
    // No fixed floor: thumbnails draw the slide a third of its size and the text must shrink with it.
    fontSize: `${String(Math.max(1, Math.min(unit.value * 1.55, box.h * 0.3)))}px`,
    animationDelay: `${String(node.layer * 0.12)}s`,
  };
}

const summary = computed(() => `Diagrama: ${model.value.nodes.map((node) => node.text).join(', ')}`);
</script>

<template>
  <div ref="root" class="el-diagram" :data-kind="kind" :data-animated="animated" :style="fillVars(data.color, 'solid', 'primary')" role="img" :aria-label="summary" data-testid="diagram">
    <svg v-if="ready" class="links" :viewBox="`0 0 ${W} ${H}`" :width="W" :height="H" aria-hidden="true">
      <defs>
        <marker :id="markerId" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto" markerUnits="strokeWidth">
          <path d="M0 0 L10 5 L0 10 L2.5 5 z" class="head" />
        </marker>
      </defs>
      <path v-for="link in links" :key="link.key" :d="link.path" class="link" fill="none" :stroke-width="link.width" :stroke-dasharray="link.dash" stroke-linecap="round" :marker-end="link.arrow ? `url(#${markerId})` : undefined" :style="{ animationDelay: `${link.delay}s` }" />
    </svg>
    <span
      v-for="link in ready ? links.filter((item) => item.label !== '') : []"
      :key="`label-${link.key}`"
      class="label"
      :style="{ left: `${link.at.x}px`, top: `${link.at.y}px`, fontSize: `${Math.max(1, unit * 1.15)}px`, animationDelay: `${link.delay}s` }"
    >{{ link.label }}</span>
    <span v-for="node in ready ? drawn.nodes : []" :key="node.id" class="node" :data-shape="node.shape" :style="nodeStyle(node)"><span class="text">{{ node.text }}</span></span>
  </div>
</template>

<style scoped>
.el-diagram { position: relative; width: 100%; height: 100%; }
.links { position: absolute; inset: 0; overflow: visible; pointer-events: none; }
.link { stroke: var(--sl-slate); }
.head { fill: var(--sl-slate); }
.node { position: absolute; box-sizing: border-box; display: flex; align-items: center; justify-content: center; padding: 0 0.7em; border-radius: 0.5em; background: var(--fill); color: var(--fill-fg); border: 0.12em solid var(--fill-edge); box-shadow: var(--sl-elev-1); font-weight: 600; line-height: 1.2; text-align: center; }
.node[data-shape='round'] { border-radius: 1.1em; }
.node[data-shape='stadium'] { border-radius: 99em; }
.node[data-shape='circle'] { border-radius: 50%; }
/* The padding is in em: a percentage would be taken from the frame of the diagram, not from the node. */
.node[data-shape='diamond'] { border-radius: 0; padding: 0 1.9em; clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); border: 0; box-shadow: none; }
.text { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden; overflow-wrap: anywhere; }
.label { position: absolute; transform: translate(-50%, -50%); padding: 0.1em 0.55em; border-radius: 99em; background: var(--sl-card); border: 1px solid var(--sl-line); color: var(--sl-ink-2); font-weight: 600; white-space: nowrap; }
[data-animated='true'] .node { animation: sl-zoom 0.45s var(--sl-ease-bounce) both; }
[data-animated='true'] .link, [data-animated='true'] .label { animation: diagram-fade 0.5s ease-out both; }

@keyframes diagram-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
