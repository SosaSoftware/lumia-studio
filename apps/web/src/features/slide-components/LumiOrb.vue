<script setup lang="ts">
/**
 * Drawing of Lumi's orb in its five designs. It fills its box, which should be square; the box sets the size of
 * every layer through container units. `active` turns the motion on; at rest the orb shows its still pose.
 */
withDefaults(defineProps<{ variant?: string; state?: string; active?: boolean }>(), { variant: 'halo', state: 'idle', active: true });
</script>

<template>
  <span class="lumi-orb" :data-variant="variant" :data-state="state" :data-active="active" aria-hidden="true">
    <template v-if="variant === 'equalizer'">
      <span class="eq-glow"></span>
      <span class="eq-bars"><i v-for="bar in 7" :key="bar" class="eq-bar"></i></span>
    </template>
    <template v-else-if="variant === 'pulse'">
      <span class="pulse-ring"></span><span class="pulse-ring"></span><span class="pulse-ring"></span>
      <span class="pulse-arc"></span>
      <span class="pulse-core"></span>
    </template>
    <template v-else-if="variant === 'plasma'">
      <span class="plasma-body">
        <span class="plasma-layer"></span><span class="plasma-layer"></span><span class="plasma-layer"></span>
        <span class="plasma-surface"></span>
      </span>
    </template>
    <template v-else-if="variant === 'wave'">
      <span class="wave-body">
        <span class="wave-line"></span><span class="wave-line"></span><span class="wave-line"></span>
        <span class="wave-center"></span>
      </span>
    </template>
    <template v-else>
      <span class="halo-glow"></span>
      <span class="halo-ring"></span><span class="halo-ring second"></span>
      <span class="halo-disc"></span>
      <span class="halo-core"></span>
      <span class="halo-orbit"></span>
    </template>
  </span>
</template>

<style scoped>
/* Colors come from --orb-a and --orb-b, set by the component that draws the orb. */
.lumi-orb { --orb-a: var(--sl-primary); --orb-b: var(--sl-accent); position: relative; display: block; width: 100%; height: 100%; container-type: size; }
.lumi-orb > span, .plasma-body > span, .wave-line { position: absolute; border-radius: 50%; }
.lumi-orb:not([data-active='true']) *, .lumi-orb:not([data-active='true']) *::before { animation-play-state: paused !important; }

/* Halo */
.halo-glow { inset: -12%; background: radial-gradient(circle, color-mix(in srgb, var(--orb-a) 30%, transparent) 0%, transparent 70%); animation: orb-glow 3s ease-in-out infinite; }
.halo-ring { inset: 6%; background: conic-gradient(from 0deg, transparent, var(--orb-b), transparent 30%); -webkit-mask: radial-gradient(transparent 60%, #000 62%); mask: radial-gradient(transparent 60%, #000 62%); animation: sl-spin 4s linear infinite; }
.halo-ring.second { animation-duration: 3s; animation-direction: reverse; opacity: 0.6; }
.halo-disc { inset: 15%; background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--orb-a) 60%, white) 0%, var(--orb-a) 40%, color-mix(in srgb, var(--orb-a) 55%, black) 100%); box-shadow: inset 0 -6cqmin 15cqmin rgba(0, 0, 0, 0.3), inset 0 6cqmin 15cqmin rgba(255, 255, 255, 0.1), 0 0 20cqmin color-mix(in srgb, var(--orb-a) 40%, transparent); }
.halo-core { inset: 28%; background: radial-gradient(circle at 40% 35%, color-mix(in srgb, var(--orb-b) 45%, white) 0%, var(--orb-b) 50%, var(--orb-a) 100%); box-shadow: 0 0 15cqmin color-mix(in srgb, var(--orb-b) 60%, transparent); animation: orb-breathe 2s ease-in-out infinite; }
.halo-orbit { inset: 0; border: 0.5cqmin solid color-mix(in srgb, var(--orb-b) 30%, transparent); animation: sl-spin 8s linear infinite; }
.halo-orbit::before { content: ''; position: absolute; top: -2.5cqmin; left: 50%; width: 5cqmin; height: 5cqmin; border-radius: 50%; background: var(--orb-b); box-shadow: 0 0 6cqmin var(--orb-b); }

/* Equalizer */
[data-variant='equalizer'] { border-radius: 50%; overflow: hidden; background: radial-gradient(circle at 35% 30%, #1A2332 0%, #0A0E1A 100%); border: 1cqmin solid color-mix(in srgb, var(--orb-b) 30%, transparent); box-shadow: inset 0 0 20cqmin color-mix(in srgb, var(--orb-a) 20%, transparent), 0 0 20cqmin color-mix(in srgb, var(--orb-a) 20%, transparent); box-sizing: border-box; }
.eq-glow { inset: 0; background: radial-gradient(circle, color-mix(in srgb, var(--orb-b) 18%, transparent) 0%, transparent 70%); animation: orb-fade 2s ease-in-out infinite; }
.lumi-orb > .eq-bars { inset: 30% 18%; display: flex; align-items: center; justify-content: center; gap: 3cqmin; border-radius: 0; }
.eq-bar { width: 3.4cqmin; border-radius: 2cqmin; background: linear-gradient(to top, var(--orb-a), var(--orb-b)); animation: orb-eq 1s ease-in-out infinite; }
.eq-bar:nth-child(1) { height: 30%; animation-delay: 0s; }
.eq-bar:nth-child(2) { height: 55%; animation-delay: 0.1s; }
.eq-bar:nth-child(3) { height: 80%; animation-delay: 0.2s; }
.eq-bar:nth-child(4) { height: 65%; animation-delay: 0.3s; }
.eq-bar:nth-child(5) { height: 90%; animation-delay: 0.4s; }
.eq-bar:nth-child(6) { height: 55%; animation-delay: 0.5s; }
.eq-bar:nth-child(7) { height: 40%; animation-delay: 0.6s; }

/* Pulse */
.pulse-ring { inset: 0; border: 1cqmin solid var(--orb-b); opacity: 0; animation: orb-ring 2s ease-out infinite; }
.pulse-ring:nth-child(2) { animation-delay: 0.5s; }
.pulse-ring:nth-child(3) { animation-delay: 1s; }
.pulse-arc { inset: 9%; border: 2cqmin solid transparent; border-top-color: var(--orb-b); border-right-color: var(--orb-b); animation: sl-spin 2s linear infinite; }
.pulse-core { inset: 19%; background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--orb-b) 45%, white) 0%, var(--orb-b) 40%, var(--orb-a) 100%); box-shadow: 0 0 20cqmin color-mix(in srgb, var(--orb-b) 50%, transparent), inset 0 -5cqmin 12cqmin rgba(0, 0, 0, 0.2); animation: orb-breathe 2s ease-in-out infinite; }

/* Plasma */
.plasma-body { inset: 0; overflow: hidden; box-shadow: 0 0 30cqmin color-mix(in srgb, var(--orb-a) 30%, transparent); background: color-mix(in srgb, var(--orb-a) 35%, #0A0E27); }
.plasma-layer { inset: 0; filter: blur(10cqmin); animation: orb-morph 8s ease-in-out infinite; }
.plasma-layer:nth-child(1) { background: radial-gradient(circle at 30% 30%, var(--orb-a) 0%, transparent 60%); }
.plasma-layer:nth-child(2) { background: radial-gradient(circle at 70% 70%, var(--orb-b) 0%, transparent 60%); animation-delay: -2s; }
.plasma-layer:nth-child(3) { background: radial-gradient(circle at 50% 50%, var(--sl-purple) 0%, transparent 50%); animation-delay: -4s; }
.plasma-surface { inset: 0; background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.2) 0%, transparent 50%); border: 0.6cqmin solid rgba(255, 255, 255, 0.12); box-sizing: border-box; }

/* Wave */
.wave-body { inset: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 35% 30%, #0F1623 0%, #06070D 100%); border: 0.6cqmin solid color-mix(in srgb, var(--orb-b) 25%, transparent); box-sizing: border-box; }
.wave-line { width: 200%; height: 200%; left: -50%; top: -50%; border: 1.2cqmin solid; box-sizing: border-box; animation: sl-spin 6s linear infinite; }
.wave-line:nth-child(1) { border-color: color-mix(in srgb, var(--orb-a) 45%, transparent); border-radius: 46% 54% 50% 50%; }
.wave-line:nth-child(2) { border-color: color-mix(in srgb, var(--orb-b) 35%, transparent); border-radius: 52% 48% 46% 54%; animation-duration: 4s; animation-direction: reverse; }
.wave-line:nth-child(3) { border-color: color-mix(in srgb, var(--orb-b) 22%, white 10%); border-radius: 48% 52% 54% 46%; animation-duration: 8s; }
.wave-center { position: relative; width: 38%; border-radius: 50%; height: 38%; background: linear-gradient(135deg, var(--orb-a), var(--orb-b)); box-shadow: 0 0 15cqmin color-mix(in srgb, var(--orb-a) 50%, transparent); animation: orb-breathe 2s ease-in-out infinite; z-index: 1; }

/* States change the tempo and the intensity. */
[data-state='listening'] .pulse-ring, [data-state='listening'] .halo-glow { animation-duration: 1.2s; }
[data-state='listening'] .halo-core, [data-state='listening'] .wave-center { animation-duration: 1.2s; }
[data-state='thinking'] .halo-ring, [data-state='thinking'] .pulse-arc { animation-duration: 1.2s; }
[data-state='thinking'] .plasma-layer { animation-duration: 3s; }
[data-state='speaking'] .eq-bar { animation-duration: 0.4s; }
[data-state='speaking'] .halo-core, [data-state='speaking'] .pulse-core, [data-state='speaking'] .wave-center { animation-duration: 0.5s; }
[data-state='speaking'] .wave-line { animation-duration: 2s; }
[data-state='idle'] .eq-bar { animation-duration: 1.6s; }
[data-state='idle'] .pulse-ring { animation-duration: 3s; }

@keyframes orb-glow {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.1); opacity: 0.85; }
}

@keyframes orb-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

@keyframes orb-fade {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

@keyframes orb-eq {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(0.3); }
}

@keyframes orb-ring {
  0% { transform: scale(0.6); opacity: 0.8; }
  100% { transform: scale(1.4); opacity: 0; }
}

@keyframes orb-morph {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(10%, -10%) scale(1.1); }
  50% { transform: translate(-5%, 10%) scale(0.9); }
  75% { transform: translate(-10%, -5%) scale(1.05); }
}
</style>
