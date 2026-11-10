import { ENTRANCES } from '../../api/types.ts';
import type { Entrance, SlideElement } from '../../api/types.ts';
import { num, rec, str } from '../../api/decode.ts';

/** What of an element travels in the clipboard: everything that defines it, and nothing that identifies it. */
export interface ClippedElement {
  readonly component: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly appearsAtS: number;
  readonly entrance: Entrance;
  readonly props: Record<string, unknown>;
}

export interface ClipboardContent {
  /** Slide the elements were copied from. */
  readonly slideId: string;
  readonly elements: readonly ClippedElement[];
  /** Times the content was already pasted, to place each paste a little further from the last. */
  readonly pasted: number;
}

export const CLIPBOARD_KEY = 'lumia.studio.element-clipboard';

/** Distance in `cqw` between a copy and what it was copied from, so it does not hide it. */
export const PASTE_OFFSET = 2;

/** The part of an element that is copied; its props are copied by value. */
export function clipElement(element: SlideElement): ClippedElement {
  return {
    component: element.component,
    name: element.name,
    x: element.x,
    y: element.y,
    w: element.w,
    h: element.h,
    appearsAtS: element.appearsAtS,
    entrance: element.entrance,
    props: rec(JSON.parse(JSON.stringify(element.props))),
  };
}

function decodeElement(value: unknown): ClippedElement | null {
  const item = rec(value);
  const component = str(item.component);
  if (component === '') return null;
  return {
    component,
    name: str(item.name),
    x: num(item.x),
    y: num(item.y),
    w: num(item.w),
    h: num(item.h),
    appearsAtS: num(item.appearsAtS),
    entrance: ENTRANCES.find((candidate) => candidate === item.entrance) ?? 'none',
    props: rec(item.props),
  };
}

function decodeContent(raw: string): ClipboardContent | null {
  const value = rec(JSON.parse(raw));
  const elements = (Array.isArray(value.elements) ? value.elements : []).map(decodeElement).filter((element): element is ClippedElement => element !== null);
  if (elements.length === 0) return null;
  return { slideId: str(value.slideId), elements, pasted: num(value.pasted) };
}

/**
 * Elements copied from the canvas. They live in the browser storage, so they can be pasted into any slide or class
 * and from another tab, and they are still there after a reload; the system clipboard is left alone.
 */
export class ElementClipboard {
  /** Used when the storage is blocked, so copying and pasting still work in the open tab. */
  private memory: ClipboardContent | null = null;

  public constructor(private readonly storage: Storage = localStorage) {}

  public get hasContent(): boolean {
    return this.read() !== null;
  }

  /** Replaces the content with copies of these elements. */
  public write(slideId: string, elements: readonly SlideElement[]): void {
    this.store({ slideId, elements: elements.map(clipElement), pasted: 0 });
  }

  public read(): ClipboardContent | null {
    try {
      const raw = this.storage.getItem(CLIPBOARD_KEY);
      return raw === null ? this.memory : decodeContent(raw);
    } catch {
      // A blocked storage or a stored value that is not a clipboard: the copy in memory, if there is one, is the clipboard.
      return this.memory;
    }
  }

  /** Distance to place the next paste into `slideId` from the copied position, and counts the paste. */
  public nextOffset(slideId: string): number {
    const content = this.read();
    if (content === null) return 0;
    // Pasting into the slide the elements came from starts one step away, so the copy does not sit on the original.
    const steps = content.pasted + (content.slideId === slideId ? 1 : 0);
    this.store({ ...content, pasted: content.pasted + 1 });
    return steps * PASTE_OFFSET;
  }

  private store(content: ClipboardContent): void {
    this.memory = content;
    try {
      this.storage.setItem(CLIPBOARD_KEY, JSON.stringify(content));
    } catch {
      // The copy in memory still works in this tab.
    }
  }
}
