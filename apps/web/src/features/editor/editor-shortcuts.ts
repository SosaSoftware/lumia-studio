import { hasTextSelection } from '../../composables/shortcuts.ts';
import type { Shortcut } from '../../composables/shortcuts.ts';
import type { DocumentSession } from './document-session.ts';
import { PASTE_OFFSET, clipElement } from './element-clipboard.ts';
import type { ElementClipboard } from './element-clipboard.ts';

/** What the shortcuts of the editor work on. */
export interface EditorShortcutContext {
  readonly session: DocumentSession;
  readonly clipboard: ElementClipboard;
  /** Whether the person may change the class right now: their role allows it and Lumi is not working on it. */
  readonly canEdit: () => boolean;
}

type EditorShortcut = Shortcut<EditorShortcutContext>;

function hasSlide(context: EditorShortcutContext): boolean {
  return context.session.currentSlide !== null;
}

/** Something is selected on the canvas and no text is, so copying means copying the elements. */
function canCopy(context: EditorShortcutContext): boolean {
  return context.session.selectedElements.length > 0 && !hasTextSelection();
}

function copySelection(context: EditorShortcutContext): void {
  const slide = context.session.currentSlide;
  if (slide !== null) context.clipboard.write(slide.id, context.session.selectedElements);
}

/**
 * Keyboard shortcuts of the editor. To add one, add an entry here: `keys`, optionally `when`, and `run`. The
 * registry in `WorkspacePage` does the rest. Keys that act on the element in focus (arrows, Delete, Escape) are
 * handled by the canvas itself.
 */
export const EDITOR_SHORTCUTS: readonly EditorShortcut[] = [
  {
    id: 'undo',
    keys: ['mod+z'],
    when: (context: EditorShortcutContext): boolean => context.canEdit() && context.session.canUndo,
    run: (context: EditorShortcutContext): void => {
      void context.session.undo();
    },
  },
  {
    id: 'redo',
    keys: ['mod+shift+z', 'ctrl+y'],
    when: (context: EditorShortcutContext): boolean => context.canEdit() && context.session.canRedo,
    run: (context: EditorShortcutContext): void => {
      void context.session.redo();
    },
  },
  {
    id: 'select-all',
    keys: ['mod+a'],
    when: (context: EditorShortcutContext): boolean => (context.session.currentSlide?.elements.length ?? 0) > 0,
    run: (context: EditorShortcutContext): void => {
      context.session.selectAllElements();
    },
  },
  {
    id: 'copy',
    keys: ['mod+c'],
    when: canCopy,
    run: copySelection,
  },
  {
    id: 'cut',
    keys: ['mod+x'],
    when: (context: EditorShortcutContext): boolean => context.canEdit() && canCopy(context),
    run: (context: EditorShortcutContext): void => {
      const ids = context.session.selectedElements.map((element) => element.id);
      copySelection(context);
      void context.session.deleteElements(ids);
    },
  },
  {
    id: 'paste',
    keys: ['mod+v'],
    when: (context: EditorShortcutContext): boolean => context.canEdit() && hasSlide(context) && context.clipboard.hasContent,
    run: (context: EditorShortcutContext): void => {
      const slide = context.session.currentSlide;
      const content = context.clipboard.read();
      if (slide === null || content === null) return;
      void context.session.pasteElements(content.elements, context.clipboard.nextOffset(slide.id));
    },
  },
  {
    id: 'duplicate',
    keys: ['mod+d'],
    when: (context: EditorShortcutContext): boolean => context.canEdit() && context.session.selectedElements.length > 0,
    run: (context: EditorShortcutContext): void => {
      void context.session.pasteElements(context.session.selectedElements.map(clipElement), PASTE_OFFSET);
    },
  },
];
