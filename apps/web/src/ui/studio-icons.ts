/** One SVG primitive of a 24×24 stroke icon; `fill` draws it filled with the current color instead. */
export type IconShape =
  | { readonly kind: 'path'; readonly d: string; readonly fill?: boolean }
  | { readonly kind: 'rect'; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly rx?: number; readonly fill?: boolean }
  | { readonly kind: 'circle'; readonly cx: number; readonly cy: number; readonly r: number; readonly fill?: boolean };

const p = (d: string): IconShape => ({ kind: 'path', d });
const pf = (d: string): IconShape => ({ kind: 'path', d, fill: true });
const r = (x: number, y: number, w: number, h: number, rx?: number): IconShape => ({ kind: 'rect', x, y, w, h, ...(rx === undefined ? {} : { rx }) });
const rf = (x: number, y: number, w: number, h: number, rx?: number): IconShape => ({ kind: 'rect', x, y, w, h, fill: true, ...(rx === undefined ? {} : { rx }) });
const c = (cx: number, cy: number, radius: number): IconShape => ({ kind: 'circle', cx, cy, r: radius });

const GEAR =
  'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z';

const CONNECTOR = [c(6, 7, 2.5), c(18, 17, 2.5), p('M8.5 7c5 0 2 10 7 10')];
const SHAPES = [c(7.5, 7.5, 4), r(13, 13, 8, 8, 1), p('M17 3l4 7h-8zM3 21l4-7 4 7z')];
const GRIP = [c(9, 6, 1), c(15, 6, 1), c(9, 12, 1), c(15, 12, 1), c(9, 18, 1), c(15, 18, 1)];

/** Icons of the Studio interface, by name. The paths come from the Studio designs. */
export const STUDIO_ICONS: Readonly<Record<string, readonly IconShape[]>> = {
  // Activity bars
  explorer: [p('M21 12h-8M21 6H8M21 18h-8M3 6v4a2 2 0 0 0 2 2h3M3 10v6a2 2 0 0 0 2 2h3')],
  'group-slides': [r(3, 7, 15, 12, 2), p('M7 4h12a2 2 0 0 1 2 2v10')],
  'group-text': [p('M5 7V4h14v3M12 4v16M9 20h6')],
  'group-media': [r(3, 4, 18, 16, 2), c(9, 10, 2), p('m21 16-5-5-9 9')],
  'group-shapes': SHAPES,
  'group-interactive': [p('M4 4l7 16 2-7 7-2z')],
  'group-questions': [c(12, 12, 9), p('M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01')],
  settings: [c(12, 12, 3), p(GEAR)],
  properties: [p('M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6')],
  comments: [p('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM8 9h8M8 13h5')],
  'panel-slides': [r(3, 4, 18, 12, 2), p('M6 20h3M10.5 20h3M15 20h3')],
  'panel-timeline': [p('M3 7h8M7 12h12M3 17h10M15 4v16')],
  moon: [p('M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z')],
  sun: [c(12, 12, 4), p('M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41')],

  // Tree and selectors
  book: [p('M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z')],
  folder: [p('M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z')],
  'folder-open': [p('M3 17V7a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v1M3 17l2.6-6.2A2 2 0 0 1 7.4 9.5H21l-2.8 7.3A2 2 0 0 1 16.3 18H4a1 1 0 0 1-1-1z')],
  class: [r(3, 4, 18, 13, 2), p('M8 21h8M12 17v4')],
  building: [p('M3 21h18M5 21V8l7-5 7 5v13M9 21v-5h6v5')],
  calendar: [p('M3 5h18v16H3zM16 3v4M8 3v4M3 10h18')],
  'collapse-all': [p('m7 20 5-5 5 5M7 4l5 5 5-5')],
  filter: [p('M3 5h18l-7 8v6l-4 2v-8z')],

  // Generic controls
  'chevron-down': [p('m6 9 6 6 6-6')],
  'chevron-right': [p('m9 6 6 6-6 6')],
  'chevron-left': [p('m15 18-6-6 6-6')],
  check: [p('M20 6 9 17l-5-5')],
  close: [p('M18 6 6 18M6 6l12 12')],
  minus: [p('M5 12h14')],
  plus: [p('M12 5v14M5 12h14')],
  eye: [p('M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6')],
  upload: [p('M12 16V4M7 9l5-5 5 5M4 20h16')],
  more: [c(5, 12, 1), c(12, 12, 1), c(19, 12, 1)],
  copy: [r(8, 8, 13, 13, 2), p('M4 16V5a1 1 0 0 1 1-1h11')],
  trash: [p('M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6')],
  play: [pf('M8 5v14l11-7z')],
  'skip-back': [pf('M19 20 9 12l10-8z'), p('M5 19V5')],
  pause: [rf(6, 5, 4, 14, 1), rf(14, 5, 4, 14, 1)],
  history: [p('M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2')],
  send: [p('m22 2-7 20-4-9-9-4zM22 2 11 13')],
  lock: [r(5, 11, 14, 10, 2), p('M8 11V7a4 4 0 0 1 8 0v4')],
  'alert-circle': [c(12, 12, 9), p('M12 8v4M12 16h.01')],
  'check-circle': [c(12, 12, 9), p('m8 12 3 3 5-6')],
  info: [c(12, 12, 9), p('M12 11v5M12 8h.01')],
  'sign-out': [p('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9')],
  grip: GRIP,
  speaker: [p('M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7')],
  music: [p('M9 18V5l12-2v13'), c(6, 18, 3), c(18, 16, 3)],
  mic: [r(9, 2, 6, 12, 3), p('M5 10a7 7 0 0 0 14 0M12 17v5')],
  hourglass: [p('M6 2h12M6 22h12M7 2v4a5 5 0 0 0 10 0V2M7 22v-4a5 5 0 0 1 10 0v4')],
  library: [r(3, 3, 7, 7, 1), r(14, 3, 7, 7, 1), r(3, 14, 7, 7, 1), r(14, 14, 7, 7, 1)],
  link: [p('M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5')],

  // Slide types (palette group Diapositivas)
  'slide-cover': [r(3, 5, 18, 14, 2), p('M7 10h8M7 14h5')],
  'slide-explanatory': [r(3, 5, 18, 14, 2), p('M6 9h6M6 12h6M6 15h4'), r(14, 9, 4, 6, 1)],
  'slide-video': [r(3, 5, 18, 14, 2), p('m10 9 5 3-5 3z')],
  'slide-interactive_video': [r(3, 3, 18, 13, 2), p('m10 7 4.5 2.5L10 12zM3 20h18'), c(9, 20, 1.5), c(16, 20, 1.5)],
  'slide-whiteboard': [p('M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z')],
  'slide-quiz': [p('M10 6h11M10 12h11M10 18h11M3 6l1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17')],
  'slide-closing': [p('M5 21V4h12l-2 4 2 4H5')],

  // Components (palette groups)
  'cmp-title': [p('M5 7V4h14v3M12 4v16M9 20h6')],
  'cmp-paragraph': [p('M4 6h16M4 10h16M4 14h16M4 18h10')],
  'cmp-bullet_list': [c(5, 6, 1.2), c(5, 12, 1.2), c(5, 18, 1.2), p('M9 6h11M9 12h11M9 18h11')],
  'cmp-callout': [p('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z')],
  'cmp-table': [r(3, 4, 18, 16, 2), p('M3 10h18M3 15h18M10 4v16')],
  'cmp-image': [r(3, 4, 18, 16, 2), c(9, 10, 2), p('m21 16-5-5-9 9')],
  'cmp-video': [r(2, 6, 14, 12, 2), p('m22 8-6 4 6 4z')],
  'cmp-audio': [p('M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14')],
  'cmp-icon': [p('M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z')],
  'cmp-illustration': [p('M12 3a9 9 0 0 0 0 18c1.2 0 1.5-1 1-2-.6-1.2.2-2.5 1.5-2.5H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5z'), c(7.5, 11, 1), c(10, 7, 1), c(15, 7.5, 1)],
  'cmp-shape': SHAPES,
  'cmp-arrow': [p('M4 12h15M14 6l6 6-6 6')],
  'cmp-connector': CONNECTOR,
  'cmp-diagram': [r(9, 3, 6, 5, 1), r(3, 16, 6, 5, 1), r(15, 16, 6, 5, 1), p('M12 8v4M6 16v-4h12v4')],
  'cmp-button_link': [r(3, 7, 18, 10, 5), p('M8 12h8')],
  'cmp-hotspot': [c(12, 12, 9), c(12, 12, 5), c(12, 12, 1.5)],
  'cmp-flip_card': [r(3, 8, 11, 13, 2), p('M8 8V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-5')],
  'cmp-tabs': [p('M3 8h18v12H3zM3 8V5h6v3M9 5h6v3')],
  'cmp-accordion': [p('M3 4h18v4H3zM3 10h18v4H3zM3 16h18v4H3z')],
  'cmp-gallery': [r(3, 3, 8, 8, 1), r(13, 3, 8, 8, 1), r(3, 13, 8, 8, 1), r(13, 13, 8, 8, 1)],
  'cmp-timeline_component': [p('M3 12h18'), c(6, 12, 2), c(12, 12, 2), c(18, 12, 2)],
  'cmp-timer': [c(12, 13, 8), p('M12 9v4l2.5 2.5M9 2h6')],
  'cmp-multiple_choice': [c(6, 7, 2.5), c(6, 17, 2.5), p('M11 7h10M11 17h10')],
  'cmp-true_false': [p('m3 12 3 3 5-6M14 9l6 6M20 9l-6 6')],
  'cmp-fill_blank': [p('M3 8h18M3 14h5M16 14h5M10 17h4')],
  'cmp-drag_drop': [p('M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3')],
  'cmp-ordering': [p('M8 4v16M4 16l4 4 4-4M16 20V4M12 8l4-4 4 4')],
  'cmp-matching': CONNECTOR,
};

export function iconShapes(name: string): readonly IconShape[] {
  return STUDIO_ICONS[name] ?? [];
}
