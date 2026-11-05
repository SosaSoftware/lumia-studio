import { describe, expect, it } from 'vitest';
import { advanceState, isFinished, isVisibleAt, stepIndex } from './preview-clock.ts';

describe('preview clock', () => {
  it('shows an element from its appearsAtS', () => {
    expect(isVisibleAt({ appearsAtS: 1.6 }, 1.5)).toBe(false);
    expect(isVisibleAt({ appearsAtS: 1.6 }, 1.6)).toBe(true);
    expect(isVisibleAt({ appearsAtS: 0 }, 0)).toBe(true);
  });

  it('finishes only automatic slides after their duration', () => {
    expect(isFinished({ advance: 'auto', durationS: 8 }, 7.9)).toBe(false);
    expect(isFinished({ advance: 'auto', durationS: 8 }, 8)).toBe(true);
    expect(isFinished({ advance: 'click', durationS: 8 }, 100)).toBe(false);
  });

  it('keeps the index inside the deck', () => {
    expect(stepIndex(0, -1, 3)).toBe(0);
    expect(stepIndex(1, 1, 3)).toBe(2);
    expect(stepIndex(2, 1, 3)).toBe(2);
    expect(stepIndex(0, 1, 0)).toBe(0);
  });
});

describe('advance when the questions are completed', () => {
  it('blocks moving forward until every question is completed, then moves on by itself', () => {
    expect(advanceState('on_complete', ['q1', 'q2'], new Set())).toEqual({ blocked: true, autoAdvance: false });
    expect(advanceState('on_complete', ['q1', 'q2'], new Set(['q1']))).toEqual({ blocked: true, autoAdvance: false });
    expect(advanceState('on_complete', ['q1', 'q2'], new Set(['q1', 'q2']))).toEqual({ blocked: false, autoAdvance: true });
  });

  it('never blocks other modes or a slide without questions, and never finishes by time', () => {
    expect(advanceState('click', ['q1'], new Set())).toEqual({ blocked: false, autoAdvance: false });
    expect(advanceState('auto', ['q1'], new Set())).toEqual({ blocked: false, autoAdvance: false });
    expect(advanceState('on_complete', [], new Set())).toEqual({ blocked: false, autoAdvance: false });
    expect(isFinished({ advance: 'on_complete', durationS: 8 }, 100)).toBe(false);
  });
});
