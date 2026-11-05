import { reactive, watch } from 'vue';

/** Component groups of the palette, in the order of the activity bar. */
export const PALETTE_GROUPS = ['slides', 'text', 'media', 'shapes', 'interactive', 'questions'] as const;
export type PaletteGroup = (typeof PALETTE_GROUPS)[number];

export type LeftPanel = 'explorer' | PaletteGroup;
export type RightPanel = 'lumi' | 'properties' | 'comments';
export type BottomPanel = 'slides' | 'timeline';

export interface PanelState {
  /** The explorer (content tree) or one component group, one at a time. */
  left: LeftPanel | null;
  right: RightPanel | null;
  bottom: BottomPanel | null;
  /** Shows the outline and the name of each component on the canvas. */
  tags: boolean;
  /** Last component group used, opened by `open_panel('components')`. */
  lastGroup: PaletteGroup;
}

export const PANELS_KEY = 'lumia.studio.panels';

const DEFAULTS: PanelState = { left: 'explorer', right: 'lumi', bottom: 'slides', tags: true, lastGroup: 'slides' };

export function isPaletteGroup(value: unknown): value is PaletteGroup {
  return PALETTE_GROUPS.some((group) => group === value);
}

function leftOf(value: unknown, lastGroup: PaletteGroup): LeftPanel | null {
  if (value === null) return null;
  if (value === 'explorer' || isPaletteGroup(value)) return value;
  // Before the component groups had their own buttons the palette was a single `components` panel.
  if (value === 'components') return lastGroup;
  return DEFAULTS.left;
}

export function readPanels(storage: Storage = localStorage): PanelState {
  try {
    const raw = storage.getItem(PANELS_KEY);
    if (raw === null) return { ...DEFAULTS };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULTS };
    const value: Record<string, unknown> = { ...parsed };
    const lastGroup = isPaletteGroup(value.lastGroup) ? value.lastGroup : DEFAULTS.lastGroup;
    return {
      left: leftOf(value.left, lastGroup),
      right: value.right === 'lumi' || value.right === 'properties' || value.right === 'comments' ? value.right : value.right === null ? null : DEFAULTS.right,
      bottom: value.bottom === 'slides' || value.bottom === 'timeline' ? value.bottom : value.bottom === null ? null : DEFAULTS.bottom,
      tags: typeof value.tags === 'boolean' ? value.tags : DEFAULTS.tags,
      lastGroup,
    };
  } catch {
    // A corrupted stored value falls back to the default layout.
    return { ...DEFAULTS };
  }
}

/** Open panels of the workspace, remembered in `localStorage`. */
export const panels = reactive<PanelState>(readPanels());

watch(
  panels,
  (state) => {
    try {
      localStorage.setItem(PANELS_KEY, JSON.stringify(state));
    } catch {
      // Not persisting the layout is harmless.
    }
  },
  { deep: true },
);

/** Opens a left panel, or hides it when it is already open. */
export function toggleLeft(name: LeftPanel): void {
  panels.left = panels.left === name ? null : name;
  if (isPaletteGroup(name)) panels.lastGroup = name;
}

/** Opens a right panel, or hides it when it is already open. */
export function toggleRight(name: RightPanel): void {
  panels.right = panels.right === name ? null : name;
}

/** Opens a bottom panel, or hides it when it is already open. */
export function toggleBottom(name: BottomPanel): void {
  panels.bottom = panels.bottom === name ? null : name;
}

/** Panel names used by Lumi's `open_panel` tool. */
export type PanelName = 'explorer' | 'components' | 'slides' | 'timeline' | 'properties' | 'comments' | 'lumi';

export const PANEL_NAMES: readonly PanelName[] = ['explorer', 'components', 'slides', 'timeline', 'properties', 'comments', 'lumi'];

/** Opens a panel by name; `components` opens the last component group used. */
export function openPanel(name: PanelName): void {
  switch (name) {
    case 'explorer':
      panels.left = 'explorer';
      return;
    case 'components':
      panels.left = panels.lastGroup;
      return;
    case 'lumi':
    case 'properties':
    case 'comments':
      panels.right = name;
      return;
    case 'slides':
    case 'timeline':
      panels.bottom = name;
  }
}

/** Opens one component group of the palette. */
export function openGroup(group: PaletteGroup): void {
  panels.left = group;
  panels.lastGroup = group;
}
