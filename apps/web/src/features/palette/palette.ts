import type { PaletteGroup } from '../../composables/panels.ts';
import type { CatalogComponentInfo } from '../../api/types.ts';

export const PALETTE_GROUP_NAMES: Readonly<Record<PaletteGroup, string>> = {
  slides: 'Diapositivas',
  text: 'Texto',
  media: 'Multimedia',
  shapes: 'Formas y diagramas',
  interactive: 'Interactivos',
  questions: 'Preguntas',
};

/** Hint above each group of the palette, as in the design. */
export const PALETTE_HINTS: Readonly<Record<PaletteGroup, string>> = {
  slides: 'Agrega una diapositiva en blanco al final de la clase.',
  text: 'Arrastra un componente a la diapositiva.',
  media: 'Arrastra un componente a la diapositiva.',
  shapes: 'Arrastra un componente a la diapositiva.',
  interactive: 'Elementos que el estudiante explora con un clic.',
  questions: 'Arrastra una pregunta a la diapositiva.',
};

/** Order of the components inside each group, as in the design. */
const ORDER: Readonly<Record<Exclude<PaletteGroup, 'slides'>, readonly string[]>> = {
  text: ['title', 'paragraph', 'bullet_list', 'callout', 'table'],
  media: ['image', 'video', 'audio', 'icon', 'illustration'],
  shapes: ['shape', 'arrow', 'connector', 'diagram'],
  interactive: ['button_link', 'hotspot', 'flip_card', 'tabs', 'accordion', 'gallery', 'timeline_component', 'timer'],
  questions: ['multiple_choice', 'true_false', 'fill_blank', 'drag_drop', 'ordering', 'matching'],
};

/** Components of a group in the design order; components the design does not list go at the end. */
export function componentsOf(group: Exclude<PaletteGroup, 'slides'>, components: readonly CatalogComponentInfo[]): CatalogComponentInfo[] {
  const order = ORDER[group];
  const rank = (key: string): number => {
    const index = order.indexOf(key);
    return index < 0 ? order.length : index;
  };
  return components.filter((component) => component.group === group).sort((a, b) => rank(a.key) - rank(b.key));
}

/** Short group name of the canvas tags and the timeline ("Texto · Título", "Formas · Flecha"). */
const TAG_GROUPS: Readonly<Record<string, string>> = {
  text: 'Texto',
  media: 'Multimedia',
  shapes: 'Formas',
  interactive: 'Interactivos',
  questions: 'Preguntas',
};

export function tagGroup(group: string): string {
  return TAG_GROUPS[group] ?? group;
}

/** Color of each group in the timeline. */
const GROUP_COLORS: Readonly<Record<string, string>> = {
  text: 'var(--tl-text)',
  media: 'var(--tl-media)',
  shapes: 'var(--tl-shapes)',
  interactive: 'var(--tl-interactive)',
  questions: 'var(--tl-questions)',
};

export function groupColor(group: string): string {
  return GROUP_COLORS[group] ?? 'var(--s-ico-folder)';
}

/** Drag payload type of the palette, read by the canvas. */
export const COMPONENT_MIME = 'application/x-lumia-component';
