import type { palette as esPalette } from '../es/palette.ts';

export const palette: typeof esPalette = {
  groups: {
    slides: 'Slides',
    text: 'Text',
    media: 'Media',
    shapes: 'Shapes and diagrams',
    interactive: 'Interactive',
    questions: 'Questions',
  },
  hints: {
    slides: 'Add a blank slide at the end of the class.',
    text: 'Drag a component onto the slide.',
    media: 'Drag a component onto the slide.',
    shapes: 'Drag a component onto the slide.',
    interactive: 'Elements the student explores with a click.',
    questions: 'Drag a question onto the slide.',
  },
  tags: {
    text: 'Text',
    media: 'Media',
    shapes: 'Shapes',
    interactive: 'Interactive',
    questions: 'Questions',
  },
  hide: 'Hide {name}',
  hideShort: 'Hide',
  noPermission: 'You do not have permission to edit',
  noPermissionClass: 'You do not have permission to edit this class.',
  addBlankAtEnd: 'Add a blank slide at the end',
  blank: 'Blank',
  dragToSlide: 'Drag onto the slide',
};
