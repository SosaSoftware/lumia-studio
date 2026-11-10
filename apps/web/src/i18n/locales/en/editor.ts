import type { colors as esColors, editor as esEditor } from '../es/editor.ts';

export const editor: typeof esEditor = {
  slideLabel: 'Slide {position} of {total}: {title}',
  gridToggle: 'Show or hide the grid',
  guides: 'Guides',
  tagsToggle: 'Show or hide the name of each component',
  feedbackToggle: 'Show or hide the feedback field of questions and hotspots',
  components: 'Components',
  resize: 'Resize ({handle})',
  handles: {
    nw: 'northwest',
    n: 'north',
    ne: 'northeast',
    e: 'east',
    se: 'southeast',
    s: 'south',
    sw: 'southwest',
    w: 'west',
  },
  margin: {
    top: 'Top margin: drag to move it, double-click to reset it',
    right: 'Right margin: drag to move it, double-click to reset it',
    bottom: 'Bottom margin: drag to move it, double-click to reset it',
    left: 'Left margin: drag to move it, double-click to reset it',
  },
  feedback: {
    title: 'Feedback',
    success: 'Success',
    failure: 'Failure',
    content: 'Message',
    more: 'Show another message',
  },
  announce: {
    position: '{name}: position {x}, {y}.',
    size: '{name}: size {w} by {h}.',
    deleted: '{name}: deleted.',
  },
};

export const colors: typeof esColors = {
  surface: 'Light',
  'surface-alt': 'White',
  primary: 'Blue',
  accent: 'Sky blue',
  success: 'Green',
  warning: 'Yellow',
  danger: 'Red',
  text: 'Dark',
  muted: 'Gray',
};
