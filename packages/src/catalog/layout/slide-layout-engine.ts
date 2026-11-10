import type { ComponentCatalog } from '../component-catalog.ts';
import type { Geometry } from '../geometry.ts';
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '../geometry.ts';

export interface LayoutRequest {
  component: string;
}

export interface PlacedElement extends Geometry {
  z: number;
  appearsAtS: number;
}

interface Region {
  x: number;
  w: number;
  top: number;
  bottom: number;
  centered: boolean;
}

const MARGIN_X = 6;
const CONTENT_WIDTH = SLIDE_WIDTH - MARGIN_X * 2;
const BOTTOM = SLIDE_HEIGHT - 3;
const GAP = 2;
const MIN_HEIGHT = 4;
const APPEAR_STEP_S = 0.8;
const FULL_WIDTH_GROUPS = new Set(['text', 'questions']);

/**
 * Computes element positions for a slide so that callers (Lumi and the editor) only choose components and content:
 * the title on top and the rest below it, with the media on one side of the text when there is both.
 * Results never overlap and always stay inside the slide.
 */
export class SlideLayoutEngine {
  public constructor(private readonly catalog: ComponentCatalog) {}

  public place(elements: readonly LayoutRequest[]): PlacedElement[] {
    const placed = new Array<Geometry | undefined>(elements.length);
    const titleIndex = elements.findIndex((element) => element.component === 'title');
    const rest = elements.map((element, index) => ({ element, index })).filter(({ index }) => index !== titleIndex);

    if (titleIndex >= 0) placed[titleIndex] = { x: MARGIN_X, y: 4, w: CONTENT_WIDTH, h: 8 };
    const top = titleIndex >= 0 ? 14 : 5;

    const media = rest.filter(({ element }) => this.catalog.get(element.component)?.usesMedia === true);
    const body = rest.filter(({ element }) => this.catalog.get(element.component)?.usesMedia !== true);

    if (media.length > 0 && body.length > 0) {
      this.stack(media, { x: 60, w: 34, top, bottom: BOTTOM, centered: false }, placed);
      this.stack(body, { x: MARGIN_X, w: 50, top, bottom: BOTTOM, centered: false }, placed);
    } else {
      this.stack(rest, { x: MARGIN_X, w: CONTENT_WIDTH, top, bottom: BOTTOM, centered: false }, placed);
    }

    let order = 0;
    return placed.map((geometry, index) => {
      const value = geometry ?? { x: MARGIN_X, y: top, w: CONTENT_WIDTH, h: MIN_HEIGHT };
      const appearsAtS = index === titleIndex ? 0 : Math.round(++order * APPEAR_STEP_S * 10) / 10;
      return { ...this.round(value), z: index + 1, appearsAtS };
    });
  }

  private stack(items: readonly { element: LayoutRequest; index: number }[], region: Region, placed: (Geometry | undefined)[]): void {
    if (items.length === 0) return;
    const sizes = items.map(({ element }) => this.desiredSize(element.component, region.w));
    let gap = GAP;
    const available = region.bottom - region.top;
    let total = sizes.reduce((sum, size) => sum + size.h, 0) + gap * (items.length - 1);
    if (total > available) {
      gap = items.length > 1 ? Math.min(GAP, 1) : 0;
      const factor = (available - gap * (items.length - 1)) / sizes.reduce((sum, size) => sum + size.h, 0);
      for (const size of sizes) size.h = Math.max(MIN_HEIGHT, size.h * factor);
      total = sizes.reduce((sum, size) => sum + size.h, 0) + gap * (items.length - 1);
      if (total > available) {
        const even = (available - gap * (items.length - 1)) / items.length;
        for (const size of sizes) size.h = even;
      }
    }
    let y = region.top;
    items.forEach(({ index }, position) => {
      const size = sizes[position] ?? { w: region.w, h: MIN_HEIGHT };
      const x = region.centered ? region.x + (region.w - size.w) / 2 : region.x;
      placed[index] = { x, y, w: size.w, h: size.h };
      y += size.h + gap;
    });
  }

  private desiredSize(component: string, regionWidth: number): { w: number; h: number } {
    const definition = this.catalog.get(component);
    if (!definition) return { w: regionWidth, h: 10 };
    const { w, h } = definition.defaultSize;
    if (FULL_WIDTH_GROUPS.has(definition.group)) return { w: regionWidth, h };
    const width = Math.min(w, regionWidth);
    return { w: width, h: (h * width) / w };
  }

  private round(geometry: Geometry): Geometry {
    const floor2 = (value: number): number => Math.floor(value * 100) / 100;
    return { x: floor2(geometry.x), y: floor2(geometry.y), w: floor2(geometry.w), h: floor2(geometry.h) };
  }
}
