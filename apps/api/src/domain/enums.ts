import { AppError } from '../shared/errors/index.ts';

export const TRANSITIONS = ['none', 'fade', 'slide', 'zoom'] as const;
export { ADVANCE_MODES } from '@lumia/packages/catalog';
export const ENTRANCES = ['none', 'appear', 'fade', 'slide', 'draw'] as const;
export const AUDIO_KINDS = ['music', 'effect'] as const;
export const PAUSE_ENDS = ['continue', 'wait_click'] as const;

/** Returns `value` when it is one of `allowed`; otherwise throws a `ValidationError` that names the field. */
export function oneOf<T extends string>(field: string, value: string, allowed: readonly T[]): T {
  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined) {
    throw AppError.validation(`${field}: debe ser uno de ${allowed.join(', ')}.`);
  }
  return match;
}

/** Throws a `ValidationError` unless `value` is inside `[min, max]`. */
export function inRange(field: string, value: number, min: number, max: number = Number.POSITIVE_INFINITY): number {
  if (value < min || value > max) {
    throw AppError.validation(
      max === Number.POSITIVE_INFINITY ? `${field}: debe ser mayor o igual a ${String(min)}.` : `${field}: debe estar entre ${String(min)} y ${String(max)}.`,
    );
  }
  return value;
}
