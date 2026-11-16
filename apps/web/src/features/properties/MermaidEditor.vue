<script setup lang="ts">
import { computed } from 'vue';
import { flowchartToCode, legacyFlow, legacyMind, mindmapToCode, nextNodeId, parseFlowchart, parseMindmap } from '@lumia/packages/catalog';
import type { FlowModel, MindNode, NodeShape } from '@lumia/packages/catalog';
import { list, rec, str } from '../../api/decode.ts';
import { t } from '../../i18n/index.ts';
import ChipGroup from './ChipGroup.vue';
import { inputValue } from './controls.ts';

/**
 * Editor of the diagram text. The text is the source of truth: the box takes Mermaid typed by hand or written by
 * Lumi, and the visual controls below add, rename, connect and remove nodes by rewriting that text. The visual
 * controls turn off while the text has errors, so a click never drops lines the parser could not read.
 */
const props = defineProps<{
  modelValue: string;
  /** `flowchart` for diagrams, `mindmap` for mind maps. */
  editor: string;
  /** All props of the element: diagrams made before they were text still carry `nodes` and `edges` (or `center` and `branches`). */
  root: Record<string, unknown>;
  label: string;
  disabled?: boolean;
  invalid?: boolean;
  testid?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const SHAPES: readonly NodeShape[] = ['rect', 'round', 'stadium', 'circle', 'diamond'];
const mind = computed(() => props.editor === 'mindmap');

const legacyFlowModel = computed<FlowModel>(() =>
  legacyFlow(
    list(props.root.nodes).map((item) => ({ id: str(rec(item).id), text: str(rec(item).text) })),
    list(props.root.edges).map((item) => ({ from: str(rec(item).from), to: str(rec(item).to) })),
  ),
);
const legacyMindTree = computed<MindNode | null>(() => {
  const center = str(props.root.center);
  if (center === '') return null;
  return legacyMind(
    `${str(props.root.emoji) === '' ? '' : `${str(props.root.emoji)} `}${center}`,
    list(props.root.branches).map((item) => ({ text: str(rec(item).text), emoji: str(rec(item).emoji), details: list(rec(item).details).map((detail) => str(detail)) })),
  );
});

/** Text shown in the box: the saved text, or the old nodes and edges written as text so the first edit converts them. */
const shown = computed(() => {
  if (props.modelValue.trim() !== '') return props.modelValue;
  if (mind.value) return legacyMindTree.value === null ? '' : mindmapToCode(legacyMindTree.value);
  return legacyFlowModel.value.nodes.length === 0 ? '' : flowchartToCode(legacyFlowModel.value);
});

const flow = computed(() => parseFlowchart(shown.value));
const tree = computed(() => parseMindmap(shown.value));
const issues = computed(() => (mind.value ? tree.value.issues : flow.value.issues));
const editable = computed(() => !props.disabled && issues.value.length === 0);

function setCode(event: Event): void {
  emit('update:modelValue', inputValue(event));
}

// --- Flowchart ----------------------------------------------------------------------------------------------------

function cloneFlow(): FlowModel {
  return { nodes: flow.value.model.nodes.map((node) => ({ ...node })), links: flow.value.model.links.map((link) => ({ ...link })), direction: flow.value.model.direction };
}

function commitFlow(model: FlowModel): void {
  emit('update:modelValue', flowchartToCode(model));
}

const orientations = computed(() => [
  { value: 'LR', label: t('properties.diagram.horizontal') },
  { value: 'TD', label: t('properties.diagram.vertical') },
]);

function setDirection(value: string): void {
  const model = cloneFlow();
  model.direction = value === 'TD' ? 'TD' : 'LR';
  commitFlow(model);
}

function addNode(): void {
  const model = cloneFlow();
  model.nodes.push({ id: nextNodeId(model.nodes.map((node) => node.id)), text: t('properties.diagram.newNode'), shape: 'rect' });
  commitFlow(model);
}

/** Connects the last node to the first one it does not reach yet, which chains new nodes without extra clicks. */
function addLink(): void {
  const model = cloneFlow();
  const last = model.nodes[model.nodes.length - 1];
  if (last === undefined) return;
  const target = model.nodes.find((node) => node.id !== last.id && !model.links.some((link) => link.from === last.id && link.to === node.id));
  // Every node is already linked from the last one: chain the previous node to it instead.
  const from = target === undefined ? (model.nodes[model.nodes.length - 2] ?? model.nodes[0]) : last;
  const to = target ?? last;
  if (from === undefined || from.id === to.id) return;
  model.links.push({ from: from.id, to: to.id, label: '', line: 'solid', arrow: true });
  commitFlow(model);
}

function renameNode(index: number, text: string): void {
  const model = cloneFlow();
  const node = model.nodes[index];
  if (node === undefined) return;
  node.text = text;
  commitFlow(model);
}

function reshapeNode(index: number, shape: string): void {
  const model = cloneFlow();
  const node = model.nodes[index];
  const next = SHAPES.find((candidate) => candidate === shape);
  if (node === undefined || next === undefined) return;
  node.shape = next;
  commitFlow(model);
}

function removeNode(index: number): void {
  const model = cloneFlow();
  const [removed] = model.nodes.splice(index, 1);
  if (removed === undefined) return;
  model.links = model.links.filter((link) => link.from !== removed.id && link.to !== removed.id);
  commitFlow(model);
}

function setLink(index: number, change: { from?: string; to?: string; label?: string }): void {
  const model = cloneFlow();
  const link = model.links[index];
  if (link === undefined) return;
  Object.assign(link, change);
  commitFlow(model);
}

function removeLink(index: number): void {
  const model = cloneFlow();
  model.links.splice(index, 1);
  commitFlow(model);
}

// --- Mind map -----------------------------------------------------------------------------------------------------

interface Row {
  path: number[];
  depth: number;
  node: MindNode;
}

const rows = computed<Row[]>(() => {
  const result: Row[] = [];
  const walk = (node: MindNode, path: number[]): void => {
    result.push({ path, depth: path.length, node });
    node.children.forEach((child, index) => {
      walk(child, [...path, index]);
    });
  };
  if (tree.value.root !== null) walk(tree.value.root, []);
  return result;
});

function cloneTree(): MindNode | null {
  const copy = (node: MindNode): MindNode => ({ text: node.text, shape: node.shape, children: node.children.map(copy) });
  return tree.value.root === null ? null : copy(tree.value.root);
}

function nodeAt(root: MindNode, path: readonly number[]): MindNode | undefined {
  let current: MindNode | undefined = root;
  for (const step of path) current = current?.children[step];
  return current;
}

function commitTree(root: MindNode): void {
  emit('update:modelValue', mindmapToCode(root));
}

function renameIdea(path: number[], text: string): void {
  const root = cloneTree();
  const node = root === null ? undefined : nodeAt(root, path);
  if (root === null || node === undefined) return;
  node.text = text;
  commitTree(root);
}

function addIdea(path: number[]): void {
  const root = cloneTree();
  const node = root === null ? undefined : nodeAt(root, path);
  if (root === null || node === undefined) return;
  node.children.push({ text: t('properties.diagram.newIdea'), shape: 'rect', children: [] });
  commitTree(root);
}

function removeIdea(path: number[]): void {
  const root = cloneTree();
  const parent = root === null ? undefined : nodeAt(root, path.slice(0, -1));
  if (root === null || parent === undefined) return;
  parent.children.splice(path[path.length - 1] ?? 0, 1);
  commitTree(root);
}

const canAddIdea = (depth: number): boolean => depth < 4 && editable.value;
const canAddRoot = computed(() => shown.value.trim() === '' && !props.disabled);

function startMap(): void {
  commitTree({ text: t('properties.diagram.centerIdea'), shape: 'circle', children: [{ text: t('properties.diagram.newIdea'), shape: 'rect', children: [] }] });
}

function shapeLabel(shape: NodeShape): string {
  return t(`properties.diagram.shapes.${shape}`);
}
</script>

<template>
  <div class="mermaid" :data-testid="testid">
    <textarea
      class="pa code"
      rows="9"
      spellcheck="false"
      :value="shown"
      :maxlength="4000"
      :disabled="disabled"
      :aria-label="label"
      :aria-invalid="invalid === true || issues.length > 0"
      :data-testid="`${testid ?? 'code'}-text`"
      @input="setCode"
    ></textarea>
    <ul v-if="issues.length > 0" class="issues" role="alert">
      <li v-for="(issue, index) in issues" :key="index">{{ t('properties.diagram.line', { line: issue.line }) }}: {{ issue.message }}</li>
    </ul>
    <details v-else class="syntax">
      <summary>{{ t('properties.diagram.syntax') }}</summary>
      <pre v-if="mind">{{ t('properties.diagram.syntaxMind') }}</pre>
      <pre v-else>{{ t('properties.diagram.syntaxFlow') }}</pre>
    </details>

    <section class="visual" :aria-label="t('properties.diagram.visual')">
      <h4 class="title">{{ t('properties.diagram.visual') }}</h4>
      <p v-if="issues.length > 0" class="note">{{ t('properties.diagram.fixFirst') }}</p>

      <template v-if="!mind">
        <div class="head">
          <span>{{ t('properties.diagram.orientation') }}</span>
          <ChipGroup :options="orientations" :model-value="flow.model.direction" :label="t('properties.diagram.orientation')" :disabled="!editable" :testid="`${testid ?? 'code'}-orientation`" @update:model-value="setDirection" />
        </div>

        <div class="head"><span>{{ t('properties.diagram.nodes') }}</span><button type="button" class="prv add" :disabled="!editable || flow.model.nodes.length >= 12" :data-testid="`${testid ?? 'code'}-add-node`" @click="addNode">+ {{ t('properties.diagram.node') }}</button></div>
        <div v-for="(node, index) in flow.model.nodes" :key="node.id" class="card nodecard">
          <span class="id" aria-hidden="true">{{ node.id }}</span>
          <input class="pv control" type="text" maxlength="120" :value="node.text" :disabled="!editable" :aria-label="t('properties.diagram.nodeText', { id: node.id })" @change="renameNode(index, inputValue($event))" />
          <button type="button" class="ib" :disabled="!editable || flow.model.nodes.length <= 2" :aria-label="t('properties.diagram.removeNode', { id: node.id })" :title="t('common.remove')" @click="removeNode(index)">×</button>
          <select class="pv select shape" :value="node.shape" :disabled="!editable" :aria-label="t('properties.diagram.shape', { id: node.id })" @change="reshapeNode(index, inputValue($event))">
            <option v-for="shape in SHAPES" :key="shape" :value="shape">{{ shapeLabel(shape) }}</option>
          </select>
        </div>

        <div class="head"><span>{{ t('properties.diagram.links') }}</span><button type="button" class="prv add" :disabled="!editable || flow.model.nodes.length < 2" :data-testid="`${testid ?? 'code'}-add-link`" @click="addLink">+ {{ t('properties.diagram.link') }}</button></div>
        <div v-for="(link, index) in flow.model.links" :key="`${link.from}-${link.to}-${index}`" class="card linkcard">
          <select class="pv select" :value="link.from" :disabled="!editable" :aria-label="t('properties.diagram.linkFrom', { n: index + 1 })" @change="setLink(index, { from: inputValue($event) })">
            <option v-for="node in flow.model.nodes" :key="node.id" :value="node.id">{{ node.id }} · {{ node.text }}</option>
          </select>
          <span class="arrow" aria-hidden="true">→</span>
          <select class="pv select" :value="link.to" :disabled="!editable" :aria-label="t('properties.diagram.linkTo', { n: index + 1 })" @change="setLink(index, { to: inputValue($event) })">
            <option v-for="node in flow.model.nodes" :key="node.id" :value="node.id">{{ node.id }} · {{ node.text }}</option>
          </select>
          <button type="button" class="ib" :disabled="!editable" :aria-label="t('properties.diagram.removeLink', { n: index + 1 })" :title="t('common.remove')" @click="removeLink(index)">×</button>
          <input class="pv control label-input" type="text" maxlength="60" :value="link.label" :placeholder="t('properties.diagram.linkLabel')" :disabled="!editable" :aria-label="t('properties.diagram.linkLabelOf', { n: index + 1 })" @change="setLink(index, { label: inputValue($event) })" />
        </div>
      </template>

      <template v-else>
        <button v-if="canAddRoot" type="button" class="prv add" @click="startMap">+ {{ t('properties.diagram.centerIdea') }}</button>
        <div v-for="row in rows" :key="row.path.join('.')" class="idea">
          <span class="indent" :style="{ width: `${row.depth * 14}px` }" aria-hidden="true"></span>
          <input class="pv control" type="text" maxlength="60" :value="row.node.text" :disabled="!editable" :data-depth="row.depth" :aria-label="row.depth === 0 ? t('properties.diagram.centerIdea') : t('properties.diagram.ideaText')" @change="renameIdea(row.path, inputValue($event))" />
          <button type="button" class="ib" :disabled="!canAddIdea(row.depth)" :aria-label="row.depth === 0 ? t('properties.diagram.addBranch') : t('properties.diagram.addIdea')" :title="row.depth === 0 ? t('properties.diagram.addBranch') : t('properties.diagram.addIdea')" :data-testid="`${testid ?? 'code'}-add-${row.path.join('-') || 'root'}`" @click="addIdea(row.path)">+</button>
          <button v-if="row.depth > 0" type="button" class="ib" :disabled="!editable" :aria-label="t('properties.diagram.removeIdea')" :title="t('common.remove')" @click="removeIdea(row.path)">×</button>
          <span v-else class="ib-slot" aria-hidden="true"></span>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.mermaid { display: flex; flex-direction: column; gap: 8px; }
.code { width: 100%; box-sizing: border-box; color: var(--s-text); font-family: 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace; font-size: 11px; line-height: 1.5; white-space: pre; overflow: auto; resize: vertical; }
.code:focus { outline: none; border-color: var(--s-active); }
.code[aria-invalid='true'] { border-color: var(--s-danger); }
.issues { margin: 0; padding: 0 0 0 16px; font-size: 12px; color: var(--s-danger); }
.syntax { font-size: 11px; color: var(--s-text-2); }
.syntax summary { cursor: pointer; }
.syntax pre { margin: 6px 0 0; padding: 8px; background: var(--s-editor); border: 1px solid var(--s-border); border-radius: 6px; font-family: 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace; font-size: 10.5px; line-height: 1.5; white-space: pre-wrap; }
.visual { display: flex; flex-direction: column; gap: 6px; padding-top: 4px; border-top: 1px solid var(--s-border); }
.title { margin: 6px 0 0; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--s-text-2); }
.note { margin: 0; font-size: 12px; color: var(--s-text-2); }
.visual > * { flex-shrink: 0; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 4px; font-size: 12px; color: var(--s-text-2); }
.add:disabled { opacity: 0.45; cursor: not-allowed; }
/* One row per idea: the indent, the text and two button slots that stay aligned at every depth. */
.idea { display: grid; grid-template-columns: auto minmax(0, 1fr) 26px 26px; align-items: center; gap: 4px; }
.indent { height: 26px; border-right: 2px solid var(--s-border); box-sizing: border-box; }
.idea:has(input[data-depth='0']) .indent { border-right: 0; }
.ib-slot { width: 26px; height: 26px; }
.id { width: 22px; flex: none; text-align: center; font-size: 11px; font-weight: 600; color: var(--s-active); }
.control { flex: 1; min-width: 0; color: var(--s-text); font: inherit; font-size: 12px; }
.select { flex: 1; min-width: 0; color: var(--s-text); font: inherit; font-size: 12px; cursor: pointer; }
/* Nodes and links are two-line cards in a grid, so nothing is squeezed or overlaps in the narrow panel. */
.card { display: grid; align-items: center; gap: 4px; padding-bottom: 6px; border-bottom: 1px dashed var(--s-border); }
.card > * { min-width: 0; }
.nodecard { grid-template-columns: 22px minmax(0, 1fr) 26px; }
.nodecard .shape { grid-column: 2 / 4; }
.linkcard { grid-template-columns: minmax(0, 1fr) 14px minmax(0, 1fr) 26px; }
.linkcard .label-input { grid-column: 1 / 4; }
.arrow { text-align: center; color: var(--s-text-2); }
.ib { width: 26px; height: 26px; flex: none; display: flex; align-items: center; justify-content: center; padding: 0; background: var(--s-input); border: 1px solid var(--s-border); border-radius: 6px; color: var(--s-text-2); font-size: 15px; line-height: 1; cursor: pointer; }
.ib:hover:not(:disabled) { color: var(--s-text); border-color: var(--s-active); }
.ib:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
