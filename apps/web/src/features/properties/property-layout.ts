import type { CatalogComponentInfo, CatalogInfo, LocalizedText, PropertyPlacementInfo, PropertySectionInfo, VisibleWhen } from '../../api/types.ts';
import { describeSchema } from './schema-form-model.ts';
import type { FieldDescriptor } from './schema-form-model.ts';

/** Fields every element has, outside its props. The name is not here: the panel shows it under the component, outside the sections. */
export const ELEMENT_FIELDS = ['x', 'y', 'w', 'h', 'entrance', 'appearsAtS', 'exit', 'disappearsAtS'] as const;

export type ElementField = (typeof ELEMENT_FIELDS)[number];

/** Fields of a slide. */
export const SLIDE_FIELDS = ['title', 'unlock', 'unlockElementId', 'durationS', 'startMode', 'startElementId', 'background', 'transition'] as const;

export type SlideField = (typeof SLIDE_FIELDS)[number];

/** One block of a section: a field of an element or of a slide, or a run of consecutive props drawn by one form. */
export type PanelBlock =
  | { kind: 'element'; field: ElementField; label: string; help: string }
  | { kind: 'slide'; field: SlideField; label: string; help: string }
  | { kind: 'props'; fields: FieldDescriptor[] };

/** A section of the panel for one element or slide, with the fields that apply to it. */
export interface PanelSection {
  key: string;
  label: string;
  nature: string;
  /** Opens by default: it holds content, the answer, what the component does, or a reference to other items. */
  startsOpen: boolean;
  basic: PanelBlock[];
  advanced: PanelBlock[];
}

interface Entry {
  section: string;
  position: number;
  advanced: boolean;
  item:
    | { kind: 'element'; field: ElementField; label: string; help: string }
    | { kind: 'slide'; field: SlideField; label: string; help: string }
    | { kind: 'prop'; field: FieldDescriptor };
}

/** Natures of the sections that open by default: what the component says, its answer and what it does. */
const OPEN_NATURES: readonly string[] = ['content', 'logic', 'behavior'];

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

/** Whether a field whose placement has `rule` shows for an element with `props`. */
export function isVisible(rule: VisibleWhen | null, props: Readonly<Record<string, unknown>>): boolean {
  if (rule === null) return true;
  const value = props[rule.prop];
  switch (rule.op) {
    case 'empty':
      return isEmpty(value);
    case 'notEmpty':
      return !isEmpty(value);
    case 'equals':
      return value === rule.value;
    case 'in':
      return rule.values.includes(value);
  }
}

/** Text of `texts` in `language`, then Spanish, then `fallback`. */
export function localizedText(texts: LocalizedText | null, language: string, fallback: string): string {
  return texts?.[language] ?? texts?.es ?? fallback;
}

/**
 * Top-level fields that the form draws inside the list they refer to, as the mark of the correct option: their own
 * control would repeat the same choice.
 */
export function inlineReferences(fields: readonly FieldDescriptor[]): FieldDescriptor[] {
  return fields.filter((field) => {
    const ref = field.ref;
    if (ref?.kind !== 'list') return false;
    const target = fields.find((candidate) => candidate.key === ref.list);
    return target?.kind === 'object-list' && target.fields.some((child) => child.key === ref.value);
  });
}

/**
 * Builds the sections of the Properties panel for one element or one slide: the sections come from the database, each
 * field goes where its placement says, and a field without a placement goes to the fallback section.
 */
export class PropertyPanelLayout {
  private readonly sections: readonly PropertySectionInfo[];
  private readonly fallback: PropertySectionInfo;

  public constructor(
    private readonly catalog: CatalogInfo,
    private readonly language: string,
  ) {
    this.sections = [...catalog.sections].sort((a, b) => a.position - b.position);
    this.fallback = this.sections.find((section) => section.isFallback) ?? this.sections.at(-1) ?? { key: 'other', nature: 'other', position: 999, labels: {}, isFallback: true };
  }

  /** Sections with at least one field for the element, in panel order. */
  public build(component: CatalogComponentInfo, props: Readonly<Record<string, unknown>>, elementLabels: Readonly<Record<ElementField, string>>): PanelSection[] {
    return this.assemble([...this.elementEntries(elementLabels), ...this.propEntries(component, props)], false);
  }

  /** Sections with at least one field of the slide, in panel order. A slide has few fields, so every section opens. */
  public buildSlide(slideLabels: Readonly<Record<SlideField, string>>): PanelSection[] {
    return this.assemble(this.slideEntries(slideLabels), true);
  }

  private assemble(entries: readonly Entry[], allOpen: boolean): PanelSection[] {
    const result: PanelSection[] = [];
    for (const section of this.knownSections()) {
      const own = entries.filter((entry) => entry.section === section.key).sort((a, b) => a.position - b.position);
      if (own.length === 0) continue;
      result.push({
        key: section.key,
        label: localizedText(section.labels, this.language, section.key),
        nature: section.nature,
        startsOpen: allOpen || OPEN_NATURES.includes(section.nature) || own.some((entry) => entry.item.kind === 'prop' && entry.item.field.ref !== null),
        basic: PropertyPanelLayout.blocks(own.filter((entry) => !entry.advanced)),
        advanced: PropertyPanelLayout.blocks(own.filter((entry) => entry.advanced)),
      });
    }
    const first = result[0];
    if (first !== undefined && !result.some((section) => section.startsOpen)) first.startsOpen = true;
    return result;
  }

  private knownSections(): PropertySectionInfo[] {
    return this.sections.length > 0 ? [...this.sections] : [this.fallback];
  }

  private sectionOf(placement: PropertyPlacementInfo | undefined): string {
    return placement !== undefined && this.sections.some((section) => section.key === placement.section) ? placement.section : this.fallback.key;
  }

  private elementEntries(labels: Readonly<Record<ElementField, string>>): Entry[] {
    const placements = new Map(this.catalog.elementLayout.map((placement) => [placement.prop, placement]));
    return ELEMENT_FIELDS.map((field, index): Entry => {
      const placement = placements.get(field);
      return {
        section: this.sectionOf(placement),
        position: placement?.position ?? 1000 + index,
        advanced: placement?.advanced ?? false,
        item: { kind: 'element', field, label: localizedText(placement?.labels ?? null, this.language, labels[field]), help: localizedText(placement?.help ?? null, this.language, '') },
      };
    });
  }

  private slideEntries(labels: Readonly<Record<SlideField, string>>): Entry[] {
    const placements = new Map(this.catalog.slideLayout.map((placement) => [placement.prop, placement]));
    return SLIDE_FIELDS.map((field, index): Entry => {
      const placement = placements.get(field);
      return {
        section: this.sectionOf(placement),
        position: placement?.position ?? 1000 + index,
        advanced: placement?.advanced ?? false,
        item: { kind: 'slide', field, label: localizedText(placement?.labels ?? null, this.language, labels[field]), help: localizedText(placement?.help ?? null, this.language, '') },
      };
    });
  }

  private propEntries(component: CatalogComponentInfo, props: Readonly<Record<string, unknown>>): Entry[] {
    const fields = describeSchema(component.propsSchema);
    const inline = new Set(inlineReferences(fields).map((field) => field.key));
    const placements = new Map(component.layout.map((placement) => [placement.prop, placement]));
    let tableShown = false;
    const entries: Entry[] = [];
    fields.forEach((field, index) => {
      if (field.auto || inline.has(field.key)) return;
      // The table editor draws every prop of the table, so only the first of them gets a place.
      if (field.control === 'table') {
        if (tableShown) return;
        tableShown = true;
      }
      const placement = placements.get(field.key);
      if (placement !== undefined && !isVisible(placement.visibleWhen, props)) return;
      const label = localizedText(placement?.labels ?? null, this.language, field.label);
      const help = localizedText(placement?.help ?? null, this.language, field.help);
      entries.push({
        section: this.sectionOf(placement),
        position: placement?.position ?? 1000 + index,
        advanced: placement?.advanced ?? false,
        item: { kind: 'prop', field: { ...field, label, help } },
      });
    });
    return entries;
  }

  /** Groups consecutive props into one block, so each run of props is one form between the element fields. */
  private static blocks(entries: readonly Entry[]): PanelBlock[] {
    const blocks: PanelBlock[] = [];
    for (const entry of entries) {
      const item = entry.item;
      if (item.kind === 'element') {
        blocks.push({ kind: 'element', field: item.field, label: item.label, help: item.help });
        continue;
      }
      if (item.kind === 'slide') {
        blocks.push({ kind: 'slide', field: item.field, label: item.label, help: item.help });
        continue;
      }
      const last = blocks.at(-1);
      if (last?.kind === 'props') last.fields.push(item.field);
      else blocks.push({ kind: 'props', fields: [item.field] });
    }
    return blocks;
  }
}
