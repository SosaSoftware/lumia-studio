import { onBeforeUnmount, onMounted } from 'vue';
import type { Ref } from 'vue';

/** Calls `close` when the pointer goes down outside `target` or Escape is pressed. */
export function useDismiss(target: Ref<HTMLElement | null>, isOpen: () => boolean, close: () => void): void {
  const onPointer = (event: PointerEvent): void => {
    if (isOpen() && event.target instanceof Node && target.value !== null && !target.value.contains(event.target)) close();
  };
  const onKey = (event: KeyboardEvent): void => {
    if (isOpen() && event.key === 'Escape') close();
  };
  onMounted(() => {
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
  });
  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onPointer);
    document.removeEventListener('keydown', onKey);
  });
}
