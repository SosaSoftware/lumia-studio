<script setup lang="ts">
import { computed } from 'vue';
import { str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { useMotion } from './motion.ts';
import { toneVars } from './tone.ts';

const props = defineProps<CatalogComponentProps>();
const { ambient } = useMotion(props);
const earned = computed(() => props.data.earned !== false);
const label = computed(() => str(props.data.label).trim());
const caption = computed(() => str(props.data.caption).trim());
</script>

<template>
  <div class="el-badge" :data-earned="earned" :data-shape="str(data.shape, 'medal')" :style="toneVars(data.color, 'warning')" data-testid="badge">
    <span class="medal-box">
      <span class="medal" role="img" :aria-label="`${earned ? 'Logro obtenido' : 'Logro bloqueado'}: ${label}`">
        <span v-if="str(data.shape, 'medal') === 'medal'" class="ribbons" aria-hidden="true"><i></i><i></i></span>
        <span class="disc">
          <span class="emoji" aria-hidden="true">{{ earned ? str(data.emoji) : '🔒' }}</span>
          <span v-if="earned && ambient && data.shine !== false" class="shine" aria-hidden="true"></span>
        </span>
      </span>
    </span>
    <span v-if="label" class="label">{{ label }}</span>
    <span v-if="caption" class="caption">{{ caption }}</span>
  </div>
</template>

<style scoped>
.el-badge { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5cqw; text-align: center; }
/* The box takes the free height and the medal is the largest square inside it, sized in container units. */
.medal-box { flex: 1; min-height: 0; width: 100%; container-type: size; display: flex; align-items: center; justify-content: center; }
.medal { position: relative; width: 100cqmin; height: 100cqmin; display: flex; align-items: center; justify-content: center; }
.ribbons { position: absolute; left: 50%; top: 52%; width: 56cqmin; height: 52cqmin; transform: translateX(-50%); display: flex; justify-content: space-between; }
.ribbons i { width: 24cqmin; height: 100%; background: var(--c-ink); clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%); transform: rotate(14deg); transform-origin: top center; }
.ribbons i:last-child { transform: rotate(-14deg); filter: brightness(1.15); }
.disc { position: relative; width: 78cqmin; height: 78cqmin; display: flex; align-items: center; justify-content: center; overflow: hidden; background: var(--c-grad); border-radius: 50%; box-shadow: inset 0 0 0 5cqmin rgba(255, 255, 255, 0.35), inset 0 -5cqmin 0 rgba(22, 22, 22, 0.1), 0 4cqmin 10cqmin color-mix(in srgb, var(--c) 40%, transparent); }
[data-shape='medal'] .disc { margin-bottom: 14cqmin; }
[data-shape='shield'] .disc { border-radius: 14% 14% 50% 50% / 12% 12% 62% 62%; height: 86cqmin; }
[data-shape='hexagon'] .disc { border-radius: 0; box-shadow: none; clip-path: polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%); height: 88cqmin; }
[data-shape='star'] .disc { border-radius: 0; box-shadow: none; width: 96cqmin; height: 96cqmin; clip-path: polygon(50% 2%, 63% 34%, 98% 37%, 71% 60%, 80% 95%, 50% 76%, 20% 95%, 29% 60%, 2% 37%, 37% 34%); }
[data-shape='hexagon'] .medal-box, [data-shape='star'] .medal-box { filter: drop-shadow(0 0.4cqw 0.8cqw color-mix(in srgb, var(--c) 45%, transparent)); }
.emoji { font-size: 40cqmin; line-height: 1; }
[data-shape='star'] .emoji { font-size: 28cqmin; margin-top: 6cqmin; }
.shine { position: absolute; inset: 0; background: linear-gradient(115deg, transparent 38%, rgba(255, 255, 255, 0.6) 50%, transparent 62%); background-size: 260% 100%; animation: sl-shine 3.6s linear infinite; }
[data-earned='false'] .disc { background: linear-gradient(135deg, var(--sl-line-2), var(--sl-line-3)); box-shadow: inset 0 0 0 5cqmin rgba(255, 255, 255, 0.3); }
[data-earned='false'] .ribbons i { background: var(--sl-ink-4); }
[data-earned='false'] .emoji { font-size: 30cqmin; opacity: 0.75; }
.label { flex: none; max-width: 100%; font-size: 1.6cqw; font-weight: 600; line-height: 1.2; color: var(--sl-fg); overflow-wrap: anywhere; }
.caption { flex: none; max-width: 100%; font-size: 1.15cqw; line-height: 1.3; color: var(--sl-fg-2); overflow-wrap: anywhere; }
[data-earned='false'] .label { color: var(--sl-fg-2); }
</style>
