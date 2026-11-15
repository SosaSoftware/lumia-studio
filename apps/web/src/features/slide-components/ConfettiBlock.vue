<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { str } from '../../api/decode.ts';
import { burstConfetti } from './confetti.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { fillVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const root = ref<HTMLElement | null>(null);
const student = computed(() => props.mode === 'student');
const trigger = computed(() => str(props.data.trigger, 'both'));
const clickable = computed(() => student.value && trigger.value !== 'auto');
const caption = computed(() => str(props.data.caption).trim());

function celebrate(): void {
  burstConfetti(root.value, str(props.data.intensity, 'medium'));
}

onMounted(() => {
  if (student.value && trigger.value !== 'click') setTimeout(celebrate, 350);
});
</script>

<template>
  <component
    :is="clickable ? 'button' : 'div'"
    ref="root"
    :type="clickable ? 'button' : undefined"
    class="el-confetti"
    :data-live="student"
    :style="fillVars(data.color, data.variant, 'purple')"
    data-testid="confetti"
    @click.stop="clickable && celebrate()"
  >
    <span class="emoji" aria-hidden="true">{{ str(data.emoji) }}</span>
    <span class="message">{{ str(data.message) }}</span>
    <span v-if="caption" class="caption">{{ caption }}</span>
    <span class="sprinkles" aria-hidden="true"><i v-for="n in 10" :key="n"></i></span>
  </component>
</template>

<style scoped>
.el-confetti { position: relative; width: 100%; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.6cqw; padding: 1.6cqw 2cqw; border: 0; border-radius: 2cqw; background: var(--fill); color: var(--fill-fg); font: inherit; text-align: center; box-shadow: var(--sl-elev-2); }
button.el-confetti { cursor: pointer; transition: transform 0.2s var(--sl-ease-bounce); }
button.el-confetti:hover { transform: scale(1.02); }
button.el-confetti:active { transform: scale(0.97); }
button.el-confetti:focus-visible { outline: 0.3cqw solid var(--c); outline-offset: 0.3cqw; }
.emoji { font-size: 6cqw; line-height: 1; }
[data-live='true'] .emoji { animation: sl-bounce 1.6s ease-in-out infinite; }
.message { font-size: 2.6cqw; font-weight: 600; line-height: 1.2; overflow-wrap: anywhere; }
.caption { font-size: 1.4cqw; line-height: 1.35; opacity: 0.85; overflow-wrap: anywhere; }
.sprinkles { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; pointer-events: none; }
.sprinkles i { position: absolute; width: 1cqw; height: 0.5cqw; border-radius: 0.2cqw; background: rgba(255, 255, 255, 0.55); }
.sprinkles i:nth-child(1) { left: 8%; top: 16%; transform: rotate(24deg); }
.sprinkles i:nth-child(2) { left: 18%; top: 72%; transform: rotate(-38deg); background: var(--sl-warning); }
.sprinkles i:nth-child(3) { left: 30%; top: 10%; transform: rotate(70deg); background: var(--sl-accent); }
.sprinkles i:nth-child(4) { left: 86%; top: 20%; transform: rotate(-20deg); background: var(--sl-pink); }
.sprinkles i:nth-child(5) { left: 76%; top: 78%; transform: rotate(48deg); }
.sprinkles i:nth-child(6) { left: 92%; top: 56%; transform: rotate(12deg); background: var(--sl-success); }
.sprinkles i:nth-child(7) { left: 5%; top: 48%; transform: rotate(-64deg); background: var(--sl-orange); }
.sprinkles i:nth-child(8) { left: 64%; top: 8%; transform: rotate(34deg); background: var(--sl-warning); }
.sprinkles i:nth-child(9) { left: 44%; top: 88%; transform: rotate(-12deg); background: var(--sl-accent); }
.sprinkles i:nth-child(10) { left: 56%; top: 84%; width: 0.6cqw; height: 0.6cqw; border-radius: 50%; }
</style>
