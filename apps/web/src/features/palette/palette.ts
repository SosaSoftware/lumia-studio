import type { PaletteGroup } from '../../composables/panels.ts';
import type { CatalogComponentInfo } from '../../api/types.ts';
import { t, translateOr } from '../../i18n/index.ts';

/** Name of a palette group in the current language. */
export function paletteGroupName(group: PaletteGroup): string {
  return t(`palette.groups.${group}`);
}

/** Hint above each group of the palette, as in the design. */
export function paletteHint(group: PaletteGroup): string {
  return t(`palette.hints.${group}`);
}

/** Order of the components inside each group, as in the design. */
const ORDER: Readonly<Record<Exclude<PaletteGroup, 'slides'>, readonly string[]>> = {
  text: ['title', 'title_animated', 'paragraph', 'paragraph_highlight', 'bullet_list', 'table', 'callout', 'quote', 'banner', 'stepper', 'typewriter', 'code_snippet'],
  media: ['image', 'video', 'audio', 'icon', 'illustration', 'animation', 'before_after', 'gallery', 'carousel'],
  decorative: ['sticker', 'badge', 'confetti'],
  shapes: ['shape', 'arrow', 'connector', 'diagram', 'mindmap', 'pyramid', 'venn', 'funnel'],
  data: ['bar_chart', 'donut_chart', 'counter', 'progress_ring', 'progress_bar', 'stat_card'],
  interactive: ['button_link', 'hotspot', 'flip_card', 'tabs', 'accordion', 'timeline_component', 'timer', 'content_grid', 'roulette', 'dice', 'scratch_card'],
  questions: ['multiple_choice', 'true_false', 'fill_blank', 'drag_drop', 'ordering', 'matching', 'quiz_timer'],
  games: ['memory', 'word_search', 'hangman', 'racing'],
  characters: ['character_guide', 'comic', 'emotion_avatar', 'scene_background'],
  lumi: ['lumi_orb', 'lumi_bubble'],
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
export function tagGroup(group: string): string {
  return translateOr(`palette.tags.${group}`, group);
}

/** Color of each group in the timeline. */
const GROUP_COLORS: Readonly<Record<string, string>> = {
  text: 'var(--tl-text)',
  media: 'var(--tl-media)',
  decorative: 'var(--tl-decorative)',
  shapes: 'var(--tl-shapes)',
  data: 'var(--tl-data)',
  interactive: 'var(--tl-interactive)',
  questions: 'var(--tl-questions)',
  games: 'var(--tl-games)',
  characters: 'var(--tl-characters)',
  lumi: 'var(--tl-lumi)',
};

export function groupColor(group: string): string {
  return GROUP_COLORS[group] ?? 'var(--s-ico-folder)';
}

/** Drag payload type of the palette, read by the canvas. */
export const COMPONENT_MIME = 'application/x-lumia-component';
