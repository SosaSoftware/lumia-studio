import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useSlideContext } from './slide-context.ts';

export type QuestionResult = 'correct' | 'incorrect';

/** Attempts and feedback of an interactive question in the student preview. */
export class QuestionState {
  private readonly used = ref(0);
  private readonly last = ref<QuestionResult | null>(null);

  public constructor(private readonly attempts: () => number) {}

  public readonly result = computed(() => this.last.value);
  public readonly attemptsLeft = computed(() => Math.max(0, this.attempts() - this.used.value));
  /** Locked after a correct answer or when the attempts run out. */
  public readonly locked = computed(() => this.last.value === 'correct' || this.attemptsLeft.value === 0);

  /** Registers an answer; ignored once locked. */
  public answer(isCorrect: boolean): void {
    if (this.locked.value) return;
    this.used.value += 1;
    this.last.value = isCorrect ? 'correct' : 'incorrect';
  }

  public reset(): void {
    this.used.value = 0;
    this.last.value = null;
  }
}

/**
 * Question state of a component that reports to its slide whether the question is completed, so the preview can
 * advance a slide "Al completar". Call it from the setup of the component.
 */
export function useQuestionState(elementId: () => string, attempts: () => number): QuestionState {
  const state = new QuestionState(attempts);
  const tracker = useSlideContext().questions ?? null;
  if (tracker !== null) {
    watch(state.locked, (done) => {
      tracker.report(elementId(), done);
    }, { immediate: true });
    onBeforeUnmount(() => {
      tracker.report(elementId(), false);
    });
  }
  return state;
}
