import { describe, expect, it } from 'vitest';
import type { NarrationClip, Pause } from '../../api/types.ts';
import { findFreeSpot } from '../editor/geometry.ts';
import { parseBlocks } from '../lumi/rich-text.ts';
import { checkUpload } from '../media/upload.ts';
import { duePause, isFinished } from '../preview/preview-clock.ts';
import { elementSpan, formatTime, narrationDuration, nextStart, seekTarget, slideDuration, sliderFromSpeed, speedFromSlider, ticks, timeAtOffset } from './timeline-model.ts';

const clip = (startsAtS: number, generatedDurationS: number, speed = 1, script = 'Hola') => ({ startsAtS, generatedDurationS, speed, script });

describe('timeline model', () => {
  it('divides the generated duration by the speed without generating again', () => {
    expect(narrationDuration(clip(0, 8))).toBe(8);
    expect(narrationDuration(clip(0, 8, 2))).toBe(4);
    expect(narrationDuration(clip(0, 0, 1, 'x'.repeat(140)))).toBe(10);
  });

  it('makes the slide last at least until its narration ends', () => {
    expect(slideDuration({ durationS: 10, narrationClips: [] })).toBe(10);
    expect(slideDuration({ durationS: 10, narrationClips: [{ ...clip(5, 9), id: 'n', slideId: 's', voice: 'Mia', audioUrl: null, status: 'ready', errorMessage: null }] })).toBe(15);
  });

  it('formats times and spaces the ruler marks like the design', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65.4)).toBe('1:05');
    expect(ticks(20)).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
    expect(ticks(50)[1]).toBe(5);
    expect(ticks(150)[1]).toBe(15);
  });

  it('appends a clip one second after the last one', () => {
    expect(nextStart([])).toBe(1);
    expect(nextStart([{ startsAtS: 6, durationS: 5 }, { startsAtS: 1, durationS: 2 }])).toBe(12);
  });

  it('maps the speed slider with 1x in the middle', () => {
    expect(speedFromSlider(0)).toBe(0.1);
    expect(speedFromSlider(50)).toBe(1);
    expect(speedFromSlider(100)).toBe(2);
    expect(sliderFromSpeed(1.5)).toBe(75);
    expect(sliderFromSpeed(0.55)).toBe(25);
  });
});

describe('preview clock', () => {
  it('stops at each pause once and finishes after the narration', () => {
    const pauses: Pause[] = [{ id: 'p1', slideId: 's', startsAtS: 4, durationS: 3, message: '', onEnd: 'continue', timerElementId: null }];
    expect(duePause(pauses, 3.9, new Set())).toBeNull();
    expect(duePause(pauses, 4, new Set())?.id).toBe('p1');
    expect(duePause(pauses, 5, new Set(['p1']))).toBeNull();
    const narration: NarrationClip[] = [{ ...clip(5, 9), id: 'n', slideId: 's', voice: 'Mia', audioUrl: null, status: 'ready', errorMessage: null }];
    expect(isFinished({ advance: 'auto', durationS: 8, narrationClips: narration }, 10)).toBe(false);
    expect(isFinished({ advance: 'auto', durationS: 8, narrationClips: narration }, 15)).toBe(true);
  });
});

describe('free spot', () => {
  it('places a new element where it does not touch the others, close to the center', () => {
    const spot = findFreeSpot([{ x: 6, y: 4, w: 88, h: 8 }], { w: 20, h: 10 });
    expect(spot).not.toBeNull();
    expect((spot?.y ?? 0) >= 13).toBe(true);
    expect(findFreeSpot([{ x: 0, y: 0, w: 100, h: 56.25 }], { w: 20, h: 10 })).toBeNull();
  });
});

describe('rich text', () => {
  it('reads paragraphs, lists and bold without HTML', () => {
    const blocks = parseBlocks('Listo. Te propongo:\n- **Portada** con el título\n- Una pregunta\n\n1. Uno\n2. Dos\n<b>no</b>');
    expect(blocks.map((block) => block.kind)).toEqual(['p', 'ul', 'ol', 'p']);
    expect(blocks[1]).toMatchObject({ kind: 'ul', items: [[{ text: 'Portada', bold: true }, { text: ' con el título', bold: false }], [{ text: 'Una pregunta', bold: false }]] });
    expect(blocks[3]).toMatchObject({ kind: 'p', inlines: [{ text: '<b>no</b>', bold: false }] });
  });
});

describe('uploads', () => {
  it('applies the size limits of each type', () => {
    expect(() => {
      checkUpload('image/png', 5 * 1024 * 1024);
    }).not.toThrow();
    expect(() => {
      checkUpload('image/png', 11 * 1024 * 1024);
    }).toThrow(/10 MB/);
    expect(() => {
      checkUpload('application/zip', 10);
    }).toThrow(/tipo/);
  });
});

describe('timer elements', () => {
  const timer = (seconds: number, autoStart: boolean, appearsAtS = 0): { component: string; props: Record<string, unknown>; appearsAtS: number } => ({
    component: 'timer',
    props: { seconds, label: '', autoStart },
    appearsAtS,
  });

  it('draws a timer while it counts down and any other element until the end of the slide', () => {
    expect(elementSpan(timer(15, false), 30)).toEqual({ start: 0, end: 15 });
    expect(elementSpan(timer(15, true, 5), 30)).toEqual({ start: 5, end: 20 });
    expect(elementSpan(timer(60, false), 30)).toEqual({ start: 0, end: 30 });
    expect(elementSpan({ component: 'title', props: {}, appearsAtS: 2 }, 30)).toEqual({ start: 2, end: 30 });
  });

  it('extends the slide until a timer that starts by itself ends', () => {
    expect(slideDuration({ durationS: 30, narrationClips: [], elements: [] })).toBe(30);
    const slide = (element: ReturnType<typeof timer>): Parameters<typeof slideDuration>[0] => ({
      durationS: 30,
      narrationClips: [],
      elements: [{ id: 't', slideId: 's', name: 'Temporizador', x: 0, y: 0, w: 20, h: 20, z: 1, entrance: 'none', mediaId: null, media: null, ...element }],
    });
    expect(slideDuration(slide(timer(45, true, 5)))).toBe(50);
    expect(slideDuration(slide(timer(45, false, 5)))).toBe(30);
  });
});

describe('playhead', () => {
  it('turns a point of the ruler into seconds, inside the slide', () => {
    expect(timeAtOffset(150, 600, 30)).toBe(7.5);
    expect(timeAtOffset(-20, 600, 30)).toBe(0);
    expect(timeAtOffset(900, 600, 30)).toBe(30);
  });

  it('moves with the arrows, Home and End', () => {
    expect(seekTarget('ArrowRight', 10, 30)).toBe(10.5);
    expect(seekTarget('ArrowLeft', 10, 30, true)).toBe(5);
    expect(seekTarget('ArrowLeft', 0.2, 30)).toBe(0);
    expect(seekTarget('Home', 12, 30)).toBe(0);
    expect(seekTarget('End', 12, 30)).toBe(30);
    expect(seekTarget('Enter', 12, 30)).toBeNull();
  });
});
