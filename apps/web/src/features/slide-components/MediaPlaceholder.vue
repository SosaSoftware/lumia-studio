<script setup lang="ts">
/** Placeholder of a medium that is still missing: shows its description so the author knows what to add. */
withDefaults(defineProps<{ alt: string; prompt?: string; tone?: 'image' | 'illustration'; compact?: boolean }>(), { prompt: '', tone: 'image', compact: false });
</script>

<template>
  <div class="placeholder" :data-tone="tone" :data-compact="compact" role="img" :aria-label="alt">
    <svg v-if="tone === 'image'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="icon">
      <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" />
    </svg>
    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="icon">
      <path d="M12 3a9 9 0 0 0 0 18c1.2 0 1.5-1 1-2-.6-1.2.2-2.5 1.5-2.5H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7" r="1" /><circle cx="15" cy="7.5" r="1" />
    </svg>
    <span class="alt">{{ alt }}</span>
    <span v-if="prompt && !compact" class="prompt">{{ prompt }}</span>
    <slot />
  </div>
</template>

<style scoped>
.placeholder { position: relative; width: 100%; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.7cqw; padding: 1.4cqw; text-align: center; border-radius: inherit; overflow: hidden; }
.placeholder[data-tone='image'] { background: linear-gradient(135deg, var(--sl-cyan-soft), var(--sl-blue-soft)); border: 0.15cqw dashed var(--sl-cyan); color: var(--sl-cyan-ink); }
.placeholder[data-tone='illustration'] { background: linear-gradient(135deg, var(--sl-amber-soft), var(--sl-cyan-soft)); border: 0.15cqw dashed var(--sl-amber); color: var(--sl-amber-ink); }
.icon { width: 4.5cqw; height: 4.5cqw; flex: none; }
.placeholder[data-compact='true'] .icon { width: 3.4cqw; height: 3.4cqw; }
.alt { max-width: 90%; font-size: 1.6cqw; font-weight: 600; line-height: 1.3; }
.placeholder[data-tone='illustration'] .alt { color: var(--sl-ink); }
.prompt { max-width: 85%; font-size: 1.25cqw; line-height: 1.4; color: var(--sl-ink-2); display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
</style>
