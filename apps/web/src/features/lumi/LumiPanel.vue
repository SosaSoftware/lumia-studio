<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { panels } from '../../composables/panels.ts';
import { useLumi, useWorkspace } from '../../composables/workspace.ts';
import { tagGroup } from '../palette/palette.ts';
import LumiStar from '../../ui/LumiStar.vue';
import StudioIcon from '../../ui/StudioIcon.vue';
import ConfirmCard from './ConfirmCard.vue';
import RichText from './RichText.vue';

const workspace = useWorkspace();
const lumi = useLumi();
const session = workspace.session;

const input = ref('');
const messagesEl = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLTextAreaElement | null>(null);

const items = computed(() => lumi.state.items);
const running = computed(() => lumi.state.running);
const node = computed(() => workspace.activeClass.value);
const slidePosition = computed(() => session.state.slides.findIndex((slide) => slide.id === session.state.selectedSlideId) + 1);

/** What Lumi sees, as the design writes it: "<class> · Diapositiva 3 · Texto · Título". */
const context = computed(() => {
  if (node.value === null) {
    const path = workspace.selectedPath.value;
    return path[path.length - 1] ?? workspace.subcategory.value?.displayName ?? 'Explorador';
  }
  const parts = [node.value.displayName];
  if (slidePosition.value > 0) parts.push(`Diapositiva ${String(slidePosition.value)}`);
  const element = session.selectedElement;
  if (element !== null) {
    const info = workspace.catalog.component(element.component);
    parts.push(info === undefined ? element.name : `${tagGroup(info.group)} · ${info.name}`);
  } else if (session.selectedNarration !== null) parts.push('Narración');
  else if (session.selectedAudio !== null) parts.push('Audio');
  else if (session.selectedPause !== null) parts.push('Pausa');
  return parts.join(' · ');
});

function scrollToBottom(): void {
  void nextTick(() => {
    const el = messagesEl.value;
    if (el !== null) el.scrollTop = el.scrollHeight;
  });
}

watch(() => [items.value.length, lumi.state.streamingText, running.value], scrollToBottom);

async function send(): Promise<void> {
  const text = input.value.trim();
  if (text === '' || running.value) return;
  input.value = '';
  await lumi.sendMessage(text);
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    void send();
  }
}

function newConversation(): void {
  lumi.newConversation();
  void nextTick(() => inputEl.value?.focus());
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

onMounted(() => {
  scrollToBottom();
  inputEl.value?.focus({ preventScroll: true });
});
</script>

<template>
  <aside class="panel" aria-labelledby="h-lumi" data-testid="panel-lumi">
    <div class="s-panel-head">
      <h2 id="h-lumi" class="lbl">Lumi</h2>
      <div class="tools">
        <button type="button" class="ib" aria-label="Nueva conversación" title="Nueva conversación" data-testid="lumi-new" @click="newConversation"><StudioIcon name="plus" :size="15" /></button>
        <button type="button" class="ib" aria-label="Historial de conversaciones" title="Historial" :aria-expanded="lumi.state.showHistory" data-testid="lumi-history" @click="lumi.state.showHistory = !lumi.state.showHistory"><StudioIcon name="history" :size="15" /></button>
        <button type="button" class="ib" aria-label="Ocultar Lumi" title="Ocultar" @click="panels.right = null"><StudioIcon name="minus" :size="15" /></button>
      </div>
    </div>

    <div v-if="lumi.state.showHistory" class="history" data-testid="lumi-history-list">
      <span class="lbl history-title">Conversaciones</span>
      <p v-if="lumi.conversations.value.length === 0" class="history-empty">Todavía no tienes conversaciones con Lumi.</p>
      <div v-for="conversation in lumi.conversations.value" :key="conversation.threadId" class="history-item" :data-current="conversation.threadId === lumi.state.threadId">
        <button type="button" class="mi history-open" :title="conversation.title" :data-testid="`lumi-conv-${conversation.threadId}`" @click="lumi.switchConversation(conversation.threadId)">
          <span class="history-name">{{ conversation.title }}</span>
          <span class="history-date">{{ formatDate(conversation.lastMessageAt) }}</span>
        </button>
        <button type="button" class="ib" aria-label="Eliminar la conversación" title="Eliminar" @click="lumi.deleteConversation(conversation.threadId)"><StudioIcon name="trash" :size="13" /></button>
      </div>
    </div>

    <div v-else ref="messagesEl" class="messages" role="log" aria-live="polite" aria-label="Conversación con Lumi" data-testid="lumi-messages">
      <template v-for="item in items" :key="item.id">
        <div v-if="item.type === 'user'" class="user" data-testid="lumi-msg-user">{{ item.content }}</div>
        <div v-else-if="item.type === 'text'" class="lumi-line" data-testid="lumi-msg-text">
          <LumiStar :size="16" class="star" />
          <RichText class="text" :text="item.content" />
        </div>
        <ConfirmCard v-else-if="item.type === 'confirm'" :item="item" @answer="lumi.answerConfirm($event)" @show="lumi.showTarget($event)" />
        <div v-else-if="item.type === 'error'" class="error" role="alert" data-testid="lumi-msg-error">
          <StudioIcon name="alert-circle" :size="15" class="error-icon" />
          <span class="error-text">{{ item.content }}<small v-if="item.detail">{{ item.detail }}</small></span>
        </div>
      </template>

      <div v-if="lumi.state.streamingText !== ''" class="lumi-line" data-testid="lumi-streaming">
        <LumiStar :size="16" class="star" />
        <span class="text">{{ lumi.state.streamingText }}<span class="cursor" aria-hidden="true"></span></span>
      </div>
    </div>

    <div class="footer">
      <div v-if="running && lumi.state.streamingText === ''" class="thinking" data-testid="lumi-thinking">
        <svg viewBox="0 0 120 120" width="22" height="22" role="img" aria-label="Lumi está pensando" class="pulso">
          <rect width="120" height="120" rx="22" :style="{ fill: 'var(--s-lumi)' }" />
          <g transform="translate(60 60) scale(0.37)">
            <path class="lumi-c lumi-pulso-star" :style="{ fill: 'var(--s-on-active)' }" d="M0,-100 C4,-6.9 4,-6.9 86.6,-50 C8,0 8,0 86.6,50 C4,6.9 4,6.9 0,100 C-4,6.9 -4,6.9 -86.6,50 C-8,0 -8,0 -86.6,-50 C-4,-6.9 -4,-6.9 0,-100Z" />
            <g class="lumi-pulso-dots" :style="{ fill: 'var(--s-lumi-dots-on)' }">
              <circle cx="35" cy="-60.6" r="10" /><circle cx="70" cy="0" r="10" /><circle cx="35" cy="60.6" r="10" />
              <circle cx="-35" cy="60.6" r="10" /><circle cx="-70" cy="0" r="10" /><circle cx="-35" cy="-60.6" r="10" />
            </g>
          </g>
        </svg>
        <span class="activity">{{ lumi.state.activity }}</span>
        <button type="button" class="stop" data-testid="lumi-stop" @click="lumi.abortRun()">Detener</button>
      </div>
      <div class="composer-wrap">
        <label class="composer">
          <span class="sr-only">Pregúntale a Lumi</span>
          <textarea
            ref="inputEl"
            v-model="input"
            rows="2"
            :placeholder="lumi.state.awaitingConfirmation ? 'Lumi espera tu confirmación' : 'Pregúntale a Lumi o pídele un cambio…'"
            aria-label="Mensaje para Lumi"
            :disabled="lumi.state.awaitingConfirmation"
            data-testid="lumi-input"
            @keydown="onKeydown"
          ></textarea>
          <span class="composer-row">
            <span class="viewing" :title="`Viendo: ${context}`" data-testid="lumi-context">
              <StudioIcon name="eye" :size="12" :stroke="2" />
              <span class="viewing-text">Viendo: <span class="viewing-value">{{ context }}</span></span>
            </span>
            <button type="button" class="send" aria-label="Enviar" title="Enviar" :aria-disabled="!lumi.connected || running || input.trim() === ''" data-testid="lumi-send" @click="send()">
              <StudioIcon name="send" :size="15" :stroke="2" />
            </button>
          </span>
        </label>
        <span class="disclaimer">Lumi es una IA y puede cometer errores.</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.panel { flex: none; width: 340px; min-height: 0; display: flex; flex-direction: column; background: var(--s-panel); border-left: 1px solid var(--s-border); }
.tools { display: flex; gap: 2px; }
.messages { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 10px 16px; display: flex; flex-direction: column; gap: 14px; }
.lumi-line { display: flex; gap: 10px; align-items: flex-start; }
.star { margin-top: 2px; }
.text { min-width: 0; line-height: 1.55; overflow-wrap: anywhere; }
.user { align-self: flex-end; max-width: 85%; padding: 10px 12px; border-radius: 12px 12px 2px 12px; background: var(--s-user-bubble); line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
.error { display: flex; gap: 10px; align-items: flex-start; color: var(--s-danger); }
.error-icon { flex: none; margin-top: 2px; }
.error-text { display: flex; flex-direction: column; gap: 2px; line-height: 1.5; }
.error-text small { color: var(--s-text-2); font-size: 11px; overflow-wrap: anywhere; }
.cursor { display: inline-block; width: 2px; height: 14px; margin-left: 1px; vertical-align: text-bottom; background: var(--s-text); }
@media (prefers-reduced-motion: no-preference) { .cursor { animation: blink 0.8s step-end infinite; } }
@keyframes blink { 50% { opacity: 0; } }
.footer { flex: none; display: flex; flex-direction: column; }
.thinking { display: flex; align-items: center; gap: 10px; padding: 12px 16px; color: var(--s-text-2); border-top: 1px solid var(--s-border); }
.pulso { flex: none; }
.activity { min-width: 0; line-height: 1.4; }
.stop { margin-left: auto; flex: none; min-height: 30px; padding: 0 10px; background: transparent; border: 1px solid var(--s-border); border-radius: 8px; color: var(--s-text); font: inherit; font-size: 12px; cursor: pointer; }
.stop:hover { background: var(--s-hover); }
.composer-wrap { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
.composer { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; background: var(--s-input); border: 1px solid var(--s-border); border-radius: 10px; cursor: text; }
.composer:focus-within { border-color: var(--s-active); }
.composer textarea { resize: none; background: transparent; border: 0; padding: 0; color: var(--s-text); font: inherit; font-size: 13px; line-height: 1.45; outline: none; }
.composer-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.viewing { display: inline-flex; align-items: center; gap: 6px; min-width: 0; font-size: 11px; padding: 3px 8px; border-radius: 999px; background: var(--s-panel); border: 1px solid var(--s-border); color: var(--s-text-2); }
.viewing-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.viewing-value { color: var(--s-text); }
.send { width: 30px; height: 30px; flex: none; display: flex; align-items: center; justify-content: center; background: var(--s-active); border: 0; border-radius: 7px; color: var(--s-on-active); cursor: pointer; }
.send[aria-disabled='true'] { cursor: default; }
.send:focus-visible { outline: 2px solid var(--s-active); outline-offset: 2px; }
.disclaimer { font-size: 11px; color: var(--s-text-2); text-align: center; }
.history { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 4px 8px 12px; display: flex; flex-direction: column; gap: 2px; }
.history-title { padding: 6px 8px; }
.history-empty { margin: 8px; font-size: 12px; color: var(--s-text-2); }
.history-item { display: flex; align-items: center; gap: 2px; border-radius: 6px; }
.history-item[data-current='true'] { background: var(--s-hover); }
.history-open { flex: 1; min-width: 0; flex-direction: column; align-items: flex-start; justify-content: center; gap: 2px; padding: 6px 10px; }
.history-name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.history-date { font-size: 11px; color: var(--s-text-2); }
</style>
