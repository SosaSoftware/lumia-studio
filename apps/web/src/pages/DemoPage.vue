<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef } from 'vue';
import { componentCatalog } from '@lumia/packages/catalog';
import { theme } from '../composables/theme.ts';
import { DemoUnavailableError, demoFileUrl, download } from '../features/demo/demo-source.ts';
import { openLumia } from '../features/demo/lumia-file.ts';
import type { LumiaClass } from '../features/demo/lumia-file.ts';
import PreviewPlayer from '../features/preview/PreviewPlayer.vue';

/** Public demo: plays one published class (a .lumia file of the demo bucket) without signing in. */
const logo = computed(() => (theme.value === 'light' ? '/logos/studio-light.png' : '/logos/studio-dark.png'));
const lesson = shallowRef<LumiaClass | null>(null);
const progress = ref(0);
const failure = ref<string | null>(null);
let disposed = false;

function isQuestion(component: string): boolean {
  return componentCatalog.get(component)?.isQuestion === true;
}

const player = useTemplateRef<{ play: () => void }>('player');
const started = ref(false);

/**
 * Starts the player on the person's first interaction with the demo. Browsers block audio until a user gesture, and
 * the class clock (and so its narration) only runs once started, so this runs inside that first click or key press.
 * Any interaction counts, including the demo's own "Empezar" button inside the slide.
 */
function start(): void {
  if (started.value) return;
  started.value = true;
  player.value?.play();
}

defineExpose({ start });

onMounted(async () => {
  try {
    const bytes = await download(await demoFileUrl(), (fraction) => {
      progress.value = fraction;
    });
    const opened = openLumia(bytes);
    if (disposed) opened.dispose();
    else lesson.value = opened;
  } catch (error) {
    failure.value = error instanceof DemoUnavailableError ? error.message : 'No se pudo cargar la demo.';
  }
});

onBeforeUnmount(() => {
  disposed = true;
  lesson.value?.dispose();
});
</script>

<template>
  <main class="demo" data-testid="demo">
    <header class="head">
      <img :src="logo" alt="Lumia Studio" class="logo" data-testid="demo-logo" />
    </header>
    <section class="content" @pointerdown.capture="start" @keydown.capture="start">
      <PreviewPlayer v-if="lesson" ref="player" :slides="lesson.slides" :media="lesson.media" :class-name="lesson.displayName" :is-question="isQuestion" :chrome="false" :auto-start="false" />
      <p v-else-if="failure" class="state" role="status" data-testid="demo-unavailable">{{ failure }}</p>
      <div v-else class="state" role="progressbar" aria-label="Cargando la demo" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.round(progress * 100)" data-testid="demo-loading">
        <span class="bar"><span class="fill" :style="{ width: `${progress * 100}%` }"></span></span>
      </div>
    </section>
  </main>
</template>

<style scoped>
.demo { height: 100vh; display: flex; flex-direction: column; background: var(--s-editor); color: var(--s-text); font-family: Lexend, system-ui, sans-serif; }
.head { flex: none; height: 64px; display: flex; align-items: center; padding: 0 28px; }
.logo { height: 30px; width: auto; }
.content { flex: 1 1 auto; min-height: 0; padding-bottom: 24px; }
.state { height: 100%; margin: 0; display: flex; align-items: center; justify-content: center; color: var(--s-text-2); font-size: 14px; }
.bar { width: min(320px, 60vw); height: 4px; border-radius: 999px; background: var(--s-hover); overflow: hidden; }
.fill { display: block; height: 100%; background: var(--s-active); transition: width 0.2s ease; }
</style>
