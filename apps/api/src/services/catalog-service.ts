import { COMPONENT_GROUP_NAMES, componentCatalog } from '@lumia/packages/catalog';
import type { ComponentCatalog } from '@lumia/packages/catalog';
import type { LocalizedText, PropertyLayoutSource, PropertyPlacementRecord, PropertySectionRecord } from '../repositories/property-layout-repository.ts';

/** Where one prop goes in the Properties panel. */
export interface PropertyPlacementDto {
  prop: string;
  section: string;
  position: number;
  advanced: boolean;
  visibleWhen: Record<string, unknown> | null;
  labels: LocalizedText | null;
  help: LocalizedText | null;
}

export interface PropertySectionDto {
  key: string;
  nature: string;
  position: number;
  labels: LocalizedText;
  isFallback: boolean;
}

export interface CatalogComponentDto {
  key: string;
  name: string;
  group: string;
  groupName: string;
  usage: string;
  /** AWSJSON values: AppSync and the local server serialize them for the client. */
  propsSchema: Record<string, unknown>;
  defaults: unknown;
  defaultSize: { w: number; h: number };
  usesMedia: boolean;
  isQuestion: boolean;
  /** One placement per visible prop, in panel order. */
  layout: PropertyPlacementDto[];
}

export interface ComponentCatalogDto {
  /** Sections of the Properties panel, in panel order. */
  sections: PropertySectionDto[];
  /** Placement of the fields every element has: geometry, entrance and appearance time. */
  elementLayout: PropertyPlacementDto[];
  /** Placement of the fields of a slide: title, unlock rule, duration, background and transition. */
  slideLayout: PropertyPlacementDto[];
  components: CatalogComponentDto[];
}

/** Key of the components column for the fields every element has. */
const ELEMENT_FIELDS = '*';

/** Key of the components column for the fields of a slide. */
const SLIDE_FIELDS = '@slide';

/** Section used when the database has none marked as fallback. */
const DEFAULT_FALLBACK: PropertySectionDto = { key: 'other', nature: 'other', position: 999, labels: { es: 'Otros', en: 'Other' }, isFallback: true };

/** Position of a prop without a placement: after every placed prop, in schema order. */
const UNPLACED_POSITION = 1000;

/**
 * Presents the component catalog, with `propsSchema` and `defaults` as JSON, for the editor and Lumi. The catalog in code
 * gives the structure of the props; the layout source gives the section and order of each one in the Properties panel.
 */
export class CatalogService {
  public constructor(
    private readonly layout: PropertyLayoutSource,
    private readonly catalog: ComponentCatalog = componentCatalog,
  ) {}

  public async describe(): Promise<ComponentCatalogDto> {
    const [sectionRecords, placementRecords] = await Promise.all([this.layout.sections(), this.layout.placements()]);
    const sections = this.sectionsWithFallback(sectionRecords);
    const known = new Set(sections.map((section) => section.key));
    const fallback = sections.find((section) => section.isFallback) ?? DEFAULT_FALLBACK;
    const byComponent = new Map<string, PropertyPlacementRecord[]>();
    for (const record of placementRecords) {
      const list = byComponent.get(record.component) ?? [];
      list.push(record);
      byComponent.set(record.component, list);
    }
    const place = (component: string, props: readonly string[]): PropertyPlacementDto[] => {
      const records = new Map((byComponent.get(component) ?? []).map((record) => [record.prop, record]));
      return props
        .map((prop, index): PropertyPlacementDto => {
          const record = records.get(prop);
          if (record === undefined || !known.has(record.section)) {
            return { prop, section: fallback.key, position: UNPLACED_POSITION + index, advanced: false, visibleWhen: null, labels: null, help: null };
          }
          return { prop, section: record.section, position: record.position, advanced: record.advanced, visibleWhen: record.visibleWhen, labels: record.labels, help: record.help };
        })
        .sort((a, b) => this.sectionPosition(sections, a.section) - this.sectionPosition(sections, b.section) || a.position - b.position);
    };
    const propsOf = (component: string): string[] => (byComponent.get(component) ?? []).map((record) => record.prop);
    return {
      sections,
      elementLayout: place(ELEMENT_FIELDS, propsOf(ELEMENT_FIELDS)),
      slideLayout: place(SLIDE_FIELDS, propsOf(SLIDE_FIELDS)),
      components: this.catalog.list().map((definition) => {
        const propsSchema = this.catalog.jsonSchema(definition.key) ?? {};
        return {
          key: definition.key,
          name: definition.name,
          group: definition.group,
          groupName: COMPONENT_GROUP_NAMES[definition.group],
          usage: definition.usage,
          propsSchema,
          defaults: definition.defaults,
          defaultSize: { w: definition.defaultSize.w, h: definition.defaultSize.h },
          usesMedia: definition.usesMedia,
          isQuestion: definition.isQuestion,
          layout: place(definition.key, CatalogService.visibleProps(propsSchema)),
        };
      }),
    };
  }

  /** Top-level props that the panel shows: every prop of the schema except the ones marked `hidden`. */
  private static visibleProps(schema: Record<string, unknown>): string[] {
    const properties = schema.properties;
    if (typeof properties !== 'object' || properties === null) return [];
    return Object.entries(properties as Record<string, unknown>) // narrowed to a non-null object above
      .filter(([, node]) => !(typeof node === 'object' && node !== null && Reflect.get(node, 'hidden') === true))
      .map(([key]) => key);
  }

  private sectionsWithFallback(records: readonly PropertySectionRecord[]): PropertySectionDto[] {
    const sections = records.map((record) => ({ ...record }));
    return sections.some((section) => section.isFallback) ? sections : [...sections, DEFAULT_FALLBACK];
  }

  private sectionPosition(sections: readonly PropertySectionDto[], key: string): number {
    return sections.find((section) => section.key === key)?.position ?? Number.MAX_SAFE_INTEGER;
  }
}
