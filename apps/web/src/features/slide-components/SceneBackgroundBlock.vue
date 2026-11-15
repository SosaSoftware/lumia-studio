<script setup lang="ts">
import { computed } from 'vue';
import { list, str } from '../../api/decode.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { seededRandom, useMotion } from './motion.ts';

interface SceneTheme {
  background: string;
  elements: readonly string[];
  /** Small lights scattered on the sky: stars, bubbles or snowflakes. */
  sparkle: 'stars' | 'bubbles' | 'snow' | 'none';
  name: string;
}

const THEMES: Readonly<Record<string, SceneTheme>> = {
  space: { background: 'radial-gradient(circle at 75% 25%, #4B2C8F 0%, transparent 45%), linear-gradient(180deg, #0A0E27 0%, #1A1A4E 55%, #2D1B69 100%)', elements: ['🪐', '🚀', '🌙', '☄️'], sparkle: 'stars', name: 'Espacio' },
  ocean: { background: 'linear-gradient(180deg, #8EE3F5 0%, #34A9DC 40%, #15609E 80%, #0C3F6E 100%)', elements: ['🐠', '🐙', '🐢', '🪸'], sparkle: 'bubbles', name: 'Océano' },
  forest: { background: 'linear-gradient(180deg, #E6F7D9 0%, #A8DCA0 45%, #5FA866 75%, #3E7E47 100%)', elements: ['🌲', '🦋', '🍄', '🐿️'], sparkle: 'none', name: 'Bosque' },
  city: { background: 'linear-gradient(180deg, #FFD3A5 0%, #FD9F80 40%, #7A5BA8 85%, #3E2E6B 100%)', elements: ['🏙️', '🚌', '🎈', '🌆'], sparkle: 'none', name: 'Ciudad' },
  desert: { background: 'linear-gradient(180deg, #FFE7B3 0%, #FFC978 45%, #E89B4C 75%, #C7743A 100%)', elements: ['🌵', '🐪', '☀️', '🦎'], sparkle: 'none', name: 'Desierto' },
  sunset: { background: 'linear-gradient(180deg, #FF9A8B 0%, #FF6A88 40%, #FF99AC 70%, #7F5A9E 100%)', elements: ['🌅', '🕊️', '⛵', '🌴'], sparkle: 'none', name: 'Atardecer' },
  snow: { background: 'linear-gradient(180deg, #DDEFFF 0%, #B9DAF5 50%, #F4F9FF 80%, #FFFFFF 100%)', elements: ['⛄', '🌨️', '🦌', '🏔️'], sparkle: 'snow', name: 'Nieve' },
};

const props = defineProps<CatalogComponentProps>();
const { ambient } = useMotion(props);
const theme = computed(() => THEMES[str(props.data.theme, 'space')] ?? { background: 'var(--sl-card-alt)', elements: [], sparkle: 'none' as const, name: 'Escena' });
const elements = computed(() => {
  const custom = list(props.data.elements).map((item) => str(item).trim()).filter((item) => item !== '');
  return custom.length > 0 ? custom : theme.value.elements;
});

/** Positions are seeded by the theme, so the scene looks the same on every render. */
const placed = computed(() => {
  const random = seededRandom(`${str(props.data.theme)}${elements.value.join('')}`);
  return elements.value.map((emoji, index) => ({
    emoji,
    left: 8 + ((index + random() * 0.6) / Math.max(1, elements.value.length)) * 84,
    top: 12 + random() * 62,
    size: 3 + random() * 3.5,
    delay: -random() * 5,
    duration: 4 + random() * 3,
  }));
});
const sparkles = computed(() => {
  if (theme.value.sparkle === 'none') return [];
  const random = seededRandom(`sparkle${str(props.data.theme)}`);
  return Array.from({ length: 28 }, () => ({ left: random() * 100, top: random() * 100, size: 0.2 + random() * 0.5, delay: -random() * 6 }));
});
</script>

<template>
  <div class="el-scene" :data-sparkle="theme.sparkle" :data-ambient="ambient && data.animated !== false" :data-dim="data.dim === true" :style="{ background: theme.background }" role="img" :aria-label="`Fondo de escena: ${theme.name}`" data-testid="scene-background">
    <span v-for="(item, index) in sparkles" :key="`s-${index}`" class="sparkle" :style="{ left: `${item.left}%`, top: `${item.top}%`, width: `${item.size}cqw`, height: `${item.size}cqw`, animationDelay: `${item.delay}s` }" aria-hidden="true"></span>
    <span v-for="(item, index) in placed" :key="`e-${index}`" class="element" :style="{ left: `${item.left}%`, top: `${item.top}%`, fontSize: `${item.size}cqw`, animationDelay: `${item.delay}s`, animationDuration: `${item.duration}s` }" aria-hidden="true">{{ item.emoji }}</span>
  </div>
</template>

<style scoped>
.el-scene { position: relative; width: 100%; height: 100%; overflow: hidden; }
.el-scene[data-dim='true']::after { content: ''; position: absolute; inset: 0; background: rgba(10, 14, 39, 0.35); pointer-events: none; }
.element { position: absolute; transform: translate(-50%, -50%); line-height: 1; filter: drop-shadow(0 0.4cqw 0.5cqw rgba(0, 0, 0, 0.2)); }
[data-ambient='true'] .element { animation: scene-drift ease-in-out infinite; }
.sparkle { position: absolute; border-radius: 50%; background: #FFFFFF; }
[data-sparkle='stars'] .sparkle { box-shadow: 0 0 0.5cqw #FFFFFF; }
[data-sparkle='bubbles'] .sparkle { background: transparent; border: 0.12cqw solid rgba(255, 255, 255, 0.7); width: 0.9cqw; height: 0.9cqw; }
[data-sparkle='snow'] .sparkle { background: #FFFFFF; box-shadow: 0 0 0.3cqw rgba(120, 160, 200, 0.6); }
[data-ambient='true'][data-sparkle='stars'] .sparkle { animation: scene-twinkle 3s ease-in-out infinite; }
[data-ambient='true'][data-sparkle='bubbles'] .sparkle { animation: scene-rise 6s linear infinite; }
[data-ambient='true'][data-sparkle='snow'] .sparkle { animation: scene-fall 7s linear infinite; }

@keyframes scene-drift {
  0%, 100% { transform: translate(-50%, -50%) rotate(-3deg); }
  50% { transform: translate(-50%, calc(-50% - 1.2cqw)) rotate(3deg); }
}

@keyframes scene-twinkle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}

@keyframes scene-rise {
  from { transform: translateY(10cqw); opacity: 0; }
  20% { opacity: 1; }
  to { transform: translateY(-30cqw); opacity: 0; }
}

@keyframes scene-fall {
  from { transform: translate(0, -20cqw); }
  to { transform: translate(3cqw, 30cqw); }
}
</style>
