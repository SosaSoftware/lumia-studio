import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import type { CatalogComponentProps } from './element-mode.ts';
import { useSlideContext } from './slide-context.ts';

/** When a component moves: entrances play for the student only; ambient loops also play on the editor canvas. */
export interface Motion {
  /** True in the student preview, where one-shot entrances and interactions run. */
  readonly live: ComputedRef<boolean>;
  /** True in the preview and on the editor canvas, but not in thumbnails: looping decoration runs here. */
  readonly ambient: ComputedRef<boolean>;
}

export function useMotion(props: CatalogComponentProps): Motion {
  return {
    live: computed(() => props.mode === 'student'),
    ambient: computed(() => props.mode === 'student' || props.design === true),
  };
}

/** True when the person asked the system to reduce motion. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Number that eases from `from` to `to` while `active` is true and rests on `to` otherwise, so the editor always
 * shows the final value.
 */
export function useCountUp(to: () => number, from: () => number, seconds: () => number, active: () => boolean): Ref<number> {
  const value = ref(to());
  let frame = 0;

  function stop(): void {
    if (frame !== 0) cancelAnimationFrame(frame);
    frame = 0;
  }

  function run(): void {
    stop();
    const target = to();
    if (!active() || prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      value.value = target;
      return;
    }
    const start = from();
    const duration = Math.max(0.1, seconds()) * 1000;
    const began = performance.now();
    value.value = start;
    const step = (now: number): void => {
      const progress = Math.min(1, (now - began) / duration);
      const eased = 1 - (1 - progress) ** 3;
      value.value = start + (target - start) * eased;
      frame = progress < 1 ? requestAnimationFrame(step) : 0;
    };
    frame = requestAnimationFrame(step);
  }

  watch([to, from, seconds, active], run, { immediate: true });
  onBeforeUnmount(stop);
  return value;
}

/**
 * Reports to the slide that an activity is completed, so a slide that advances "Al completar" can continue.
 * Returns the function that sets the state.
 */
export function useCompletion(elementId: () => string): (done: boolean) => void {
  const tracker = useSlideContext().questions ?? null;
  if (tracker === null) return () => undefined;
  tracker.report(elementId(), false);
  onBeforeUnmount(() => {
    tracker.report(elementId(), false);
  });
  return (done: boolean): void => {
    tracker.report(elementId(), done);
  };
}

/** Seeded pseudo-random generator (xorshift), so a game shows the same board on every render of the same props. */
export function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  state = state >>> 0 || 1;
  return (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}
