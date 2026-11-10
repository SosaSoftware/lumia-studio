<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { t } from '../../i18n/index.ts';
import StudioIcon from '../../ui/StudioIcon.vue';
import type { ChatItem, ConfirmState, ConfirmTarget, TargetKind } from './lumi-session.ts';

const props = defineProps<{ item: ChatItem }>();
const emit = defineEmits<{ answer: [confirmed: boolean]; show: [target: ConfirmTarget] }>();

const ICONS: Readonly<Record<TargetKind, string>> = { slide: 'panel-slides', element: 'group-shapes', narration: 'mic', audio_clip: 'music', pause: 'hourglass' };

const card = ref<HTMLElement | null>(null);
const pending = computed(() => props.item.confirmState === 'pending');
/** Deleting cannot be undone from Studio, so "Confirmar" looks destructive. */
const destructive = computed(() => (props.item.action ?? '').includes('___delete_'));

function resultLabel(state: ConfirmState | undefined): string {
  if (state === 'yes') return t('lumi.confirm.confirmed');
  if (state === 'no') return t('lumi.confirm.cancelled');
  return t('lumi.confirm.expired');
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && pending.value) {
    event.preventDefault();
    emit('answer', false);
  }
}

onMounted(() => {
  if (pending.value) void nextTick(() => card.value?.focus());
});
</script>

<template>
  <div
    ref="card"
    class="card"
    role="group"
    :aria-label="t('lumi.confirm.label')"
    :tabindex="pending ? -1 : undefined"
    data-testid="lumi-confirm"
    :data-state="item.confirmState"
    @keydown="onKeydown"
  >
    <span class="card-title">{{ t('lumi.confirm.title') }}</span>
    <span class="card-text">{{ item.content }}</span>
    <ul v-if="item.summaries && item.summaries.length > 0" class="summaries" :aria-label="t('lumi.confirm.summaries')" data-testid="confirm-summaries">
      <li v-for="(summary, index) in item.summaries" :key="index">{{ summary }}</li>
    </ul>
    <ul v-if="item.targets && item.targets.length > 0" class="targets" :aria-label="t('lumi.confirm.targets')">
      <li v-for="target in item.targets" :key="`${target.kind}:${target.id}`">
        <button type="button" class="target" :title="t('lumi.confirm.show', { kind: t(`lumi.confirm.kinds.${target.kind}`) })" :data-testid="`confirm-target-${target.id}`" @click="emit('show', target)">
          <StudioIcon :name="ICONS[target.kind]" :size="13" />
          <span class="target-label">{{ target.label }}</span>
        </button>
      </li>
    </ul>
    <div v-if="pending" class="card-actions">
      <button type="button" class="action primary" :class="{ danger: destructive }" data-testid="confirm-yes" @click="emit('answer', true)">{{ t('lumi.confirm.yes') }}</button>
      <button type="button" class="action" data-testid="confirm-no" @click="emit('answer', false)">{{ t('lumi.confirm.no') }}</button>
    </div>
    <span v-else class="card-result" data-testid="confirm-result">{{ resultLabel(item.confirmState) }}</span>
  </div>
</template>

<style scoped>
.card { margin-left: 26px; padding: 12px; display: flex; flex-direction: column; gap: 8px; border: 1px solid var(--s-border); border-radius: 10px; background: var(--s-raised); }
.card:focus-visible { outline: 2px solid var(--s-active); outline-offset: 2px; }
.card-title { font-weight: 500; }
.card-text { color: var(--s-text-2); line-height: 1.5; }
.summaries { margin: 0; padding-left: 16px; display: flex; flex-direction: column; gap: 2px; font-size: 12px; line-height: 1.5; }
.targets { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
.target { width: 100%; display: flex; align-items: center; gap: 8px; padding: 5px 8px; border: 1px solid var(--s-border); border-radius: 6px; background: transparent; color: var(--s-text); font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
.target:hover { background: var(--s-hover); }
.target:focus-visible { outline: 2px solid var(--s-active); outline-offset: 2px; }
.target-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.action { min-height: 34px; padding: 0 12px; border-radius: 8px; background: transparent; border: 1px solid var(--s-border); color: var(--s-text); font: inherit; font-size: 12px; cursor: pointer; }
.action:hover { background: var(--s-hover); }
.action.primary { background: var(--s-active); border-color: var(--s-active); color: var(--s-on-active); }
.action.primary:hover { background: var(--s-active-hover); }
.action.primary.danger { background: var(--s-danger); border-color: var(--s-danger); color: var(--s-on-active); }
.action:focus-visible { outline: 2px solid var(--s-active); outline-offset: 2px; }
.card-result { font-size: 12px; color: var(--s-text-2); }
</style>
