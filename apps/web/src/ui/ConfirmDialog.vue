<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import { t } from '../i18n/index.ts';

/**
 * Modal that asks for confirmation before something that is hard to take back. The focus starts on Cancel, so a stray
 * Enter does not confirm; Escape and a click outside cancel it, and Tab stays between its two buttons.
 */
const props = defineProps<{
  title: string;
  message: string;
  confirmLabel: string;
  /** Draws the confirm button as destructive. */
  danger?: boolean;
}>();
const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const cancelButton = ref<HTMLButtonElement | null>(null);
const confirmButton = ref<HTMLButtonElement | null>(null);

onMounted(() => {
  void nextTick(() => cancelButton.value?.focus());
});

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    emit('cancel');
    return;
  }
  if (event.key !== 'Tab') return;
  const buttons = [cancelButton.value, confirmButton.value].filter((button): button is HTMLButtonElement => button !== null);
  const first = buttons[0];
  const last = buttons[buttons.length - 1];
  if (first === undefined || last === undefined) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="overlay" data-testid="confirm-overlay" @click.self="emit('cancel')" @keydown="onKeydown">
      <section class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" data-testid="confirm-dialog">
        <h2 id="confirm-title">{{ props.title }}</h2>
        <p id="confirm-message">{{ props.message }}</p>
        <div class="actions">
          <button ref="cancelButton" type="button" class="prv" data-testid="confirm-cancel" @click="emit('cancel')">{{ t('common.cancel') }}</button>
          <button ref="confirmButton" type="button" class="pub" :class="{ danger: props.danger }" data-testid="confirm-accept" @click="emit('confirm')">{{ props.confirmLabel }}</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 130; background: var(--s-overlay); display: flex; align-items: center; justify-content: center; padding: 16px; }
.dialog { width: 100%; max-width: 380px; box-sizing: border-box; display: flex; flex-direction: column; gap: 10px; padding: 20px 22px 18px; background: var(--s-chrome); border: 1px solid var(--s-border); border-radius: 12px; box-shadow: 0 24px 60px var(--s-shadow); color: var(--s-text); font-size: 13px; }
h2 { margin: 0; font-size: 15px; font-weight: 600; }
p { margin: 0; color: var(--s-text-2); line-height: 1.5; }
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
.pub.danger { background: #C92A2A; border-color: #C92A2A; }
.pub.danger:hover { background: #A61E1E; border-color: #A61E1E; }
</style>
