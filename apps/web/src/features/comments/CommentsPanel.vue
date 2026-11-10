<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { SlideComment } from '../../api/types.ts';
import { ACTIONS, can, useApp } from '../../composables/app-context.ts';
import { panels } from '../../composables/panels.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import { formatDateTime, t } from '../../i18n/index.ts';
import StudioIcon from '../../ui/StudioIcon.vue';
import { initialsOf } from '../shell/user-display.ts';

const app = useApp();
const workspace = useWorkspace();
const session = workspace.session;
const slide = computed(() => session.currentSlide);
const position = computed(() => session.state.slides.findIndex((candidate) => candidate.id === slide.value?.id) + 1);
const total = computed(() => session.state.slides.length);
const comments = computed<SlideComment[]>(() => [...(slide.value?.comments ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
const canEdit = computed(() => can(ACTIONS.edit));
const className = computed(() => workspace.activeClass.value?.displayName ?? '');
const body = ref('');
const saving = ref(false);
const list = ref<HTMLElement | null>(null);
const MAX = 2000;

/** The API signs each comment with the name of the person. */
function author(comment: SlideComment): string {
  return comment.authorName;
}

function isOwn(comment: SlideComment): boolean {
  return comment.authorSub === (app.user.value?.sub ?? '');
}

function formatDate(iso: string): string {
  return formatDateTime(iso);
}

async function add(): Promise<void> {
  const text = body.value.trim();
  if (text === '' || saving.value || !canEdit.value) return;
  saving.value = true;
  try {
    if (await session.addComment(text)) body.value = '';
  } finally {
    saving.value = false;
  }
  await nextTick();
  list.value?.scrollTo({ top: list.value.scrollHeight });
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    void add();
  }
}

watch(() => slide.value?.id, () => {
  body.value = '';
});
</script>

<template>
  <aside class="panel" aria-labelledby="h-coms" data-testid="panel-comments">
    <div class="s-panel-head">
      <h2 id="h-coms" class="lbl">{{ t('comments.title') }}</h2>
      <button type="button" class="ib" :aria-label="t('comments.hide')" :title="t('common.hide')" @click="panels.right = null"><StudioIcon name="minus" :size="15" /></button>
    </div>
    <p v-if="!slide" class="empty">{{ t('comments.emptySlide') }}</p>
    <template v-else>
      <div class="s-identity" :aria-label="t('comments.viewing', { position, total, title: slide.title })">
        <span class="s-identity-num" aria-hidden="true">{{ position }}</span>
        <span class="s-identity-meta">
          <span class="s-identity-where">{{ t('properties.panel.slideWhere', { className, position, total }) }}</span>
          <span class="s-identity-title">{{ slide.title }}</span>
        </span>
      </div>
      <div ref="list" class="list" data-testid="comments-list" aria-live="polite">
        <span class="title">{{ t('comments.listTitle', { position }) }}</span>
        <p v-if="comments.length === 0" class="none">{{ t('comments.none') }}</p>
        <article v-for="comment in comments" :key="comment.id" class="comment" :data-testid="`comment-${comment.id}`">
          <span class="avatar" aria-hidden="true">{{ initialsOf(author(comment)) }}</span>
          <div class="content">
            <div class="meta">
              <strong>{{ author(comment) }}</strong>
              <time :datetime="comment.createdAt">{{ formatDate(comment.createdAt) }}</time>
              <button v-if="isOwn(comment) && canEdit" type="button" class="ib del" :aria-label="t('comments.deleteMine')" :title="t('comments.delete')" :data-testid="`comment-delete-${comment.id}`" @click="session.deleteComment(comment.id)">
                <StudioIcon name="trash" :size="13" />
              </button>
            </div>
            <p class="text">{{ comment.body }}</p>
          </div>
        </article>
      </div>
      <div class="composer">
        <label for="comment-body" class="sr-only">{{ t('comments.write') }}</label>
        <textarea
          id="comment-body"
          v-model="body"
          class="pa"
          rows="3"
          :maxlength="MAX"
          :placeholder="t('comments.placeholder')"
          :disabled="saving || !canEdit"
          data-testid="comment-input"
          @keydown="onKeydown"
        ></textarea>
        <div class="composer-row">
          <span class="note">{{ t('comments.hiddenFromStudents') }}</span>
          <button type="button" class="pub" :aria-disabled="saving || body.trim() === '' || !canEdit" data-testid="comment-send" @click="add">{{ saving ? t('comments.saving') : t('comments.send') }}</button>
        </div>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.panel { flex: none; width: 340px; min-height: 0; display: flex; flex-direction: column; background: var(--s-panel); border-left: 1px solid var(--s-border); }
.empty { margin: 8px 14px; font-size: 13px; color: var(--s-text-2); }
.list { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 0 12px 12px; display: flex; flex-direction: column; gap: 10px; }
.title { font-size: 12px; color: var(--s-text-2); }
.none { margin: 0; padding: 12px; border: 1px dashed var(--s-border); border-radius: 8px; font-size: 12px; line-height: 1.5; color: var(--s-text-2); text-align: center; }
.comment { display: flex; gap: 10px; padding: 10px 12px; background: var(--s-raised); border: 1px solid var(--s-border); border-radius: 8px; }
.avatar { width: 24px; height: 24px; flex: none; border-radius: 50%; background: var(--s-active); color: var(--s-on-active); display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 600; }
.content { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px; }
.meta { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.meta strong { font-weight: 500; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta time { color: var(--s-text-2); font-size: 11px; white-space: nowrap; }
.del { margin-left: auto; width: 22px; height: 22px; opacity: 0.7; }
.del:hover { opacity: 1; color: var(--s-danger); }
.text { margin: 0; font-size: 13px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
.composer { flex: none; padding: 10px 12px 12px; border-top: 1px solid var(--s-border); display: flex; flex-direction: column; gap: 8px; }
.pa { color: var(--s-text); }
.pa:focus { outline: none; border-color: var(--s-active); }
.composer-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.note { font-size: 11px; color: var(--s-text-2); }
.pub[aria-disabled='true'] { opacity: 0.45; cursor: not-allowed; }
</style>
