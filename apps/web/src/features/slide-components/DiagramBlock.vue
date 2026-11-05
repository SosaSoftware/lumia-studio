<script setup lang="ts">
import { computed } from 'vue';
import { list, rec, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';

interface DiagramNode {
  id: string;
  text: string;
}

const props = defineProps<CatalogComponentProps>();
const kind = computed(() => str(props.data.kind, 'flow'));
const nodes = computed<DiagramNode[]>(() => list(props.data.nodes).map((item) => ({ id: str(rec(item).id), text: str(rec(item).text) })));
const edges = computed(() => list(props.data.edges).map((item) => ({ from: str(rec(item).from), to: str(rec(item).to) })));

function byId(id: string): DiagramNode | undefined {
  return nodes.value.find((node) => node.id === id);
}

const root = computed(() => nodes.value.find((node) => !edges.value.some((edge) => edge.to === node.id)) ?? nodes.value[0] ?? null);

/** Children of the root, each with its own children; nodes that hang from nowhere are added as children. */
const branches = computed(() => {
  const top = root.value;
  if (top === null) return [];
  const childIds = edges.value.filter((edge) => edge.from === top.id).map((edge) => edge.to);
  const used = new Set([top.id, ...childIds]);
  const children = childIds.flatMap((id) => {
    const node = byId(id);
    return node === undefined ? [] : [node];
  });
  const result = children.map((child) => {
    const leaves = edges.value
      .filter((edge) => edge.from === child.id)
      .flatMap((edge) => {
        const node = byId(edge.to);
        if (node === undefined || used.has(node.id)) return [];
        used.add(node.id);
        return [node];
      });
    return { node: child, leaves };
  });
  for (const node of nodes.value) if (!used.has(node.id)) result.push({ node, leaves: [] });
  return result;
});

/** Nodes in the order the edges chain them, starting from the root. */
const sequence = computed(() => {
  const start = root.value;
  if (start === null) return [];
  const ordered: DiagramNode[] = [start];
  const seen = new Set([start.id]);
  let current = start;
  for (;;) {
    const next = edges.value.find((edge) => edge.from === current.id && !seen.has(edge.to));
    const node = next === undefined ? undefined : byId(next.to);
    if (node === undefined) break;
    ordered.push(node);
    seen.add(node.id);
    current = node;
  }
  for (const node of nodes.value) if (!seen.has(node.id)) ordered.push(node);
  return ordered;
});

const cycle = computed(() =>
  sequence.value.map((node, index, all) => {
    const angle = (index / all.length) * Math.PI * 2 - Math.PI / 2;
    return { node, left: 50 + 40 * Math.cos(angle), top: 50 + 38 * Math.sin(angle) };
  }),
);
</script>

<template>
  <div class="el-diagram" :data-kind="kind" role="img" :aria-label="`Diagrama: ${nodes.map((node) => node.text).join(', ')}`">
    <div v-if="kind === 'hierarchy' && root" class="tree">
      <span class="root">{{ root.text }}</span>
      <span class="stem"></span>
      <div class="children" :style="{ gridTemplateColumns: `repeat(${Math.max(branches.length, 1)}, 1fr)` }">
        <span v-if="branches.length > 1" class="rail" :style="{ left: `${50 / branches.length}%`, right: `${50 / branches.length}%` }"></span>
        <div v-for="branch in branches" :key="branch.node.id" class="branch">
          <span class="stem"></span>
          <div class="card">
            <span class="card-title">{{ branch.node.text }}</span>
            <span v-for="leaf in branch.leaves" :key="leaf.id" class="leaf">{{ leaf.text }}</span>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="kind === 'cycle'" class="cycle">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" class="ring">
        <ellipse cx="50" cy="50" rx="40" ry="38" fill="none" stroke-width="2" stroke-dasharray="5 4" vector-effect="non-scaling-stroke" />
      </svg>
      <span v-for="item in cycle" :key="item.node.id" class="cycle-node" :style="{ left: `${item.left}%`, top: `${item.top}%` }">{{ item.node.text }}</span>
    </div>
    <div v-else class="flow" :data-small="sequence.length > 4">
      <template v-for="(node, index) in sequence" :key="node.id">
        <span v-if="index > 0" class="flow-arrow" aria-hidden="true"><span class="flow-line"></span><span class="flow-head"></span></span>
        <span class="flow-node">{{ node.text }}</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.el-diagram { width: 100%; height: 100%; box-sizing: border-box; }
.tree { display: flex; flex-direction: column; align-items: center; }
.root { padding: 1.1cqw 2.6cqw; border-radius: 1.2cqw; background: var(--sl-blue); color: var(--sl-white); font-size: 2cqw; font-weight: 600; text-align: center; }
.stem { width: 0.25cqw; height: 2cqw; flex: none; background: var(--sl-slate); }
.children { position: relative; align-self: stretch; display: grid; gap: 2cqw; }
.rail { position: absolute; top: 0; height: 0.25cqw; background: var(--sl-slate); }
.branch { display: flex; flex-direction: column; align-items: center; min-width: 0; }
.card { align-self: stretch; box-sizing: border-box; padding: 1.2cqw 1.4cqw; background: var(--sl-cyan-soft); border: 0.15cqw solid var(--sl-cyan); border-radius: 1.2cqw; display: flex; flex-direction: column; gap: 0.7cqw; text-align: center; }
.card-title { font-size: 1.8cqw; font-weight: 600; color: var(--sl-cyan-ink); overflow-wrap: anywhere; }
.leaf { padding: 0.5cqw 0.8cqw; border-radius: 0.8cqw; background: var(--sl-card); font-size: 1.5cqw; color: var(--sl-ink); overflow-wrap: anywhere; }
.flow { width: 100%; height: 100%; display: flex; align-items: center; gap: 0.6cqw; }
.flow-node { flex: 1 1 0; min-width: 0; box-sizing: border-box; padding: 1.2cqw; background: var(--sl-cyan-soft); border: 0.15cqw solid var(--sl-cyan); border-radius: 1.2cqw; font-size: 1.7cqw; font-weight: 600; color: var(--sl-cyan-ink); text-align: center; overflow-wrap: anywhere; }
.flow[data-small='true'] .flow-node { font-size: 1.4cqw; padding: 0.9cqw; }
.flow-arrow { flex: none; width: 3cqw; display: flex; align-items: center; }
.flow-line { flex: 1; height: 0.3cqw; border-radius: 0.2cqw; background: var(--sl-slate); }
.flow-head { width: 0; height: 0; border-top: 0.8cqw solid transparent; border-bottom: 0.8cqw solid transparent; border-left: 1.2cqw solid var(--sl-slate); }
.cycle { position: relative; width: 100%; height: 100%; }
.ring { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.ring ellipse { stroke: var(--sl-cyan-line); }
.cycle-node { position: absolute; transform: translate(-50%, -50%); max-width: 40%; padding: 0.7cqw 1.2cqw; background: var(--sl-card); border: 0.15cqw solid var(--sl-cyan); border-radius: 99cqw; color: var(--sl-cyan-ink); font-size: 1.5cqw; font-weight: 600; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
