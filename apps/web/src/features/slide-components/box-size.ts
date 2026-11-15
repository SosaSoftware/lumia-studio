import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { Ref } from 'vue';

/** Layout size of an element in CSS pixels, plus the pixels of one `cqw` of the slide that contains it. */
export interface BoxSize {
  readonly width: Ref<number>;
  readonly height: Ref<number>;
  /** Pixels of `1cqw` of the surrounding slide; components draw SVG in pixels and size strokes with it. */
  readonly unit: Ref<number>;
}

/**
 * Observes the untransformed layout size of `target`. The editor scales the slide with CSS, so the observer's
 * content box is used instead of the bounding rectangle.
 */
export function useBoxSize(target: Ref<HTMLElement | null>): BoxSize {
  const width = ref(0);
  const height = ref(0);
  const unit = ref(1);
  let observer: ResizeObserver | null = null;

  function measure(): void {
    const element = target.value;
    if (element === null) return;
    width.value = element.clientWidth;
    height.value = element.clientHeight;
    const slide = element.closest('.slide-surface');
    unit.value = slide instanceof HTMLElement && slide.clientWidth > 0 ? slide.clientWidth / 100 : Math.max(1, element.clientWidth / 20);
  }

  onMounted(() => {
    measure();
    if (typeof ResizeObserver === 'function' && target.value !== null) {
      observer = new ResizeObserver(measure);
      observer.observe(target.value);
    }
  });
  onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
  });
  return { width, height, unit };
}
