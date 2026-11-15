import { describe, expect, it } from 'vitest';
import { slideButton } from '../slides/slide-buttons.ts';
import { isVisibleAt, nextState, stepIndex, timeState } from './preview-clock.ts';

describe('preview clock', () => {
  it('shows an element from its appearsAtS', () => {
    expect(isVisibleAt({ appearsAtS: 1.6 }, 1.5)).toBe(false);
    expect(isVisibleAt({ appearsAtS: 1.6 }, 1.6)).toBe(true);
    expect(isVisibleAt({ appearsAtS: 0 }, 0)).toBe(true);
  });

  it('runs the time of a slide until its duration', () => {
    expect(timeState(8, 4)).toEqual({ done: false, progress: 0.5 });
    expect(timeState(8, 8)).toEqual({ done: true, progress: 1 });
    expect(timeState(0, 0)).toEqual({ done: true, progress: 1 });
  });

  it('keeps the index inside the deck', () => {
    expect(stepIndex(0, -1, 3)).toBe(0);
    expect(stepIndex(1, 1, 3)).toBe(2);
    expect(stepIndex(2, 1, 3)).toBe(2);
    expect(stepIndex(0, 1, 0)).toBe(0);
  });
});

describe('Next button', () => {
  const running = { done: false, progress: 0.5 };
  const finished = { done: true, progress: 1 };
  const base = { time: running, activities: { total: 0, completed: 0 }, hasCustomButton: false, unlockedBefore: false };

  it('is on from the start for always, and never moves on by itself', () => {
    expect(nextState({ ...base, unlock: 'always' })).toEqual({ enabled: true, progress: 1, waitsFor: null });
  });

  it('waits for the time or the activities', () => {
    expect(nextState({ ...base, unlock: 'after_time' })).toEqual({ enabled: false, progress: 0.5, waitsFor: 'time' });
    expect(nextState({ ...base, unlock: 'after_time', time: finished }).enabled).toBe(true);
    expect(nextState({ ...base, unlock: 'after_activities', activities: { total: 2, completed: 1 } })).toEqual({ enabled: false, progress: 0.5, waitsFor: 'activities' });
    expect(nextState({ ...base, unlock: 'after_activities', activities: { total: 2, completed: 2 } }).enabled).toBe(true);
  });

  it('leaves the lateral Next off while a custom button moves on, and on without that button', () => {
    expect(nextState({ ...base, unlock: 'custom_button', hasCustomButton: true, unlockedBefore: true })).toEqual({ enabled: false, progress: 0, waitsFor: 'button' });
    expect(nextState({ ...base, unlock: 'custom_button' }).enabled).toBe(true);
  });

  it('ignores activities on a slide without them, and stays on for a slide unlocked before', () => {
    expect(nextState({ ...base, unlock: 'after_activities' }).enabled).toBe(true);
    expect(nextState({ ...base, unlock: 'after_time', unlockedBefore: true }).enabled).toBe(true);
  });

  it('finds a button of the slide only with the expected action', () => {
    const button = { id: 'b1', component: 'button_link', props: { action: 'start_slide' } };
    const slide = { elements: [button] } as unknown as Parameters<typeof slideButton>[0]; // only the fields slideButton reads
    expect(slideButton(slide, 'b1', ['start_slide'])?.id).toBe('b1');
    expect(slideButton(slide, 'b1', ['next_slide'])).toBeNull();
    expect(slideButton(slide, null, ['start_slide'])).toBeNull();
  });
});
