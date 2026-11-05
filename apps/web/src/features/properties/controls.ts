/** One choice of a chip group. */
export interface ChipOption<V> {
  value: V;
  label: string;
  /** The option shows but cannot be picked; `hint` says why. */
  disabled?: boolean;
  hint?: string;
}

/** Value of the input or select that fired an event. */
export function inputValue(event: Event): string {
  const target = event.target;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement ? target.value : '';
}

/** Finite number typed in an input, or null while it is empty or invalid. */
export function inputNumber(event: Event): number | null {
  const raw = inputValue(event).replace(',', '.');
  const value = Number(raw);
  return raw.trim() === '' || !Number.isFinite(value) ? null : value;
}
