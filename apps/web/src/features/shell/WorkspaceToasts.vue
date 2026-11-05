<script setup lang="ts">
import { useWorkspace } from '../../composables/workspace.ts';
import StudioIcon from '../../ui/StudioIcon.vue';

const workspace = useWorkspace();
const state = workspace.session.state;
</script>

<template>
  <div class="toasts" aria-live="polite">
    <div v-if="state.saveError" class="toast error" role="alert" data-testid="toast-error">
      <span class="icon"><StudioIcon name="alert-circle" :size="15" /></span>
      <span class="text">{{ state.saveError }}</span>
      <button type="button" class="ib" aria-label="Cerrar el aviso" title="Cerrar" @click="state.saveError = null"><StudioIcon name="close" :size="13" :stroke="2" /></button>
    </div>
    <div v-if="state.notice" class="toast" role="status" data-testid="toast-notice">
      <span class="icon ok"><StudioIcon name="check-circle" :size="15" /></span>
      <span class="text">{{ state.notice }}</span>
      <button type="button" class="ib" aria-label="Cerrar el aviso" title="Cerrar" @click="state.notice = null"><StudioIcon name="close" :size="13" :stroke="2" /></button>
    </div>
  </div>
</template>

<style scoped>
.toasts { position: fixed; right: 64px; bottom: 36px; z-index: 80; display: flex; flex-direction: column; gap: 8px; align-items: flex-end; pointer-events: none; }
.toast { pointer-events: auto; max-width: 380px; display: flex; align-items: flex-start; gap: 10px; padding: 10px 6px 10px 12px; background: var(--s-raised); border: 1px solid var(--s-border); border-radius: 8px; box-shadow: 0 14px 36px var(--s-shadow); font-size: 12px; line-height: 1.45; color: var(--s-text); }
.toast.error { border-color: var(--s-danger); }
.icon { display: flex; margin-top: 1px; color: var(--s-danger); }
.icon.ok { color: var(--s-ok); }
.text { flex: 1; padding-top: 1px; }
</style>
