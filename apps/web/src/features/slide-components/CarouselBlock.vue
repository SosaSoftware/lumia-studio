<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { list, num, rec, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useSlideContext } from './slide-context.ts';
import { fillVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const context = useSlideContext();
const items = computed(() =>
  list(props.data.items).map((item) => {
    const mediaId = str(rec(item).mediaId);
    return { emoji: str(rec(item).emoji).trim(), title: str(rec(item).title), text: str(rec(item).text), media: mediaId === '' ? null : context.media(mediaId) };
  }),
);
const index = ref(0);
const student = computed(() => props.mode === 'student');
let timer: ReturnType<typeof setInterval> | null = null;

function go(step: number): void {
  const count = items.value.length;
  if (count > 0) index.value = (index.value + step + count) % count;
}

function stop(): void {
  if (timer !== null) clearInterval(timer);
  timer = null;
}

/** Restarts the automatic advance, so a manual step gives the full interval to the new card. */
function schedule(): void {
  stop();
  if (student.value && props.data.autoPlay === true && items.value.length > 1) {
    timer = setInterval(() => {
      go(1);
    }, Math.max(2, num(props.data.intervalS, 4)) * 1000);
  }
}

function step(direction: number): void {
  go(direction);
  schedule();
}

watch(items, () => {
  if (index.value >= items.value.length) index.value = 0;
});
watch([student, () => props.data.autoPlay, () => props.data.intervalS, () => items.value.length], schedule, { immediate: true });
onBeforeUnmount(stop);
</script>

<template>
  <div class="el-carousel" :style="fillVars(data.color, data.variant ?? 'soft', 'purple')" role="group" :aria-label="`Carrusel, tarjeta ${index + 1} de ${items.length}`" data-testid="carousel">
    <div class="stage">
      <div class="track" :style="{ transform: `translateX(${-index * 100}%)` }">
        <article v-for="(item, position) in items" :key="position" class="card" :aria-hidden="position !== index">
          <span class="visual">
            <img v-if="item.media" :src="item.media.url" alt="" draggable="false" />
            <span v-else class="emoji" aria-hidden="true">{{ item.emoji || '⭐' }}</span>
          </span>
          <span class="copy">
            <span class="title">{{ item.title }}</span>
            <span v-if="item.text" class="text">{{ item.text }}</span>
          </span>
        </article>
      </div>
    </div>
    <div class="nav">
      <component :is="student ? 'button' : 'span'" :type="student ? 'button' : undefined" class="arrow" :aria-label="student ? 'Tarjeta anterior' : undefined" :aria-hidden="student ? undefined : true" @click.stop="student && step(-1)">
        <svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg>
      </component>
      <span class="dots">
        <component :is="student ? 'button' : 'span'" v-for="(_, dot) in items" :key="dot" :type="student ? 'button' : undefined" class="dot" :data-active="dot === index" :aria-label="student ? `Ver la tarjeta ${dot + 1}` : undefined" @click.stop="student && step(dot - index)"></component>
      </span>
      <component :is="student ? 'button' : 'span'" :type="student ? 'button' : undefined" class="arrow" :aria-label="student ? 'Tarjeta siguiente' : undefined" :aria-hidden="student ? undefined : true" @click.stop="student && step(1)">
        <svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></svg>
      </component>
    </div>
  </div>
</template>

<style scoped>
.el-carousel { height: 100%; display: flex; flex-direction: column; gap: 1.1cqw; }
.stage { flex: 1; min-height: 0; border-radius: 1.8cqw; overflow: hidden; background: var(--fill); color: var(--fill-fg); box-shadow: var(--sl-elev-2); }
.track { height: 100%; display: flex; transition: transform 0.5s cubic-bezier(0.65, 0, 0.35, 1); }
.card { flex: 0 0 100%; min-width: 0; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.2cqw; padding: 2cqw 2.6cqw; text-align: center; }
.visual { flex: 1; min-height: 0; width: 100%; display: flex; align-items: center; justify-content: center; }
.visual img { max-width: 100%; height: 100%; object-fit: cover; border-radius: 1.2cqw; }
.emoji { font-size: 7cqw; line-height: 1; filter: drop-shadow(0 0.5cqw 0.8cqw rgba(22, 22, 22, 0.18)); }
.copy { display: flex; flex-direction: column; gap: 0.4cqw; }
.title { font-size: 2.1cqw; font-weight: 600; line-height: 1.2; }
.text { font-size: 1.5cqw; line-height: 1.4; opacity: 0.88; overflow-wrap: anywhere; }
.nav { display: flex; align-items: center; justify-content: center; gap: 1.4cqw; }
.arrow { width: 3.2cqw; height: 3.2cqw; padding: 0; display: flex; align-items: center; justify-content: center; border: 0; border-radius: 50%; background: var(--c-soft); color: var(--c-ink); transition: transform 0.2s var(--sl-ease-bounce); }
button.arrow { cursor: pointer; }
button.arrow:hover { transform: scale(1.12); }
button.arrow:focus-visible, button.dot:focus-visible { outline: 0.25cqw solid var(--c); outline-offset: 0.2cqw; }
.arrow svg { width: 52%; height: 52%; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
.dots { display: flex; gap: 0.6cqw; }
.dot { width: 1cqw; height: 1cqw; padding: 0; border: 0; border-radius: 99cqw; background: var(--sl-line-2); transition: width 0.25s ease, background 0.25s ease; }
.dot[data-active='true'] { width: 2.6cqw; background: var(--c); }
button.dot { cursor: pointer; }
</style>
