import type { Database } from '../infrastructure/db/index.ts';

/** Texts by language code, for example `{ es: 'Contenido', en: 'Content' }`. */
export type LocalizedText = Readonly<Record<string, string>>;

/** One section of the Properties panel, from `studio.property_section`. */
export interface PropertySectionRecord {
  key: string;
  nature: string;
  position: number;
  labels: LocalizedText;
  isFallback: boolean;
}

/** Placement of one prop of one component, from `studio.component_property`. `component` is `*` for element fields. */
export interface PropertyPlacementRecord {
  component: string;
  prop: string;
  section: string;
  position: number;
  advanced: boolean;
  visibleWhen: Record<string, unknown> | null;
  labels: LocalizedText | null;
  help: LocalizedText | null;
}

/** Source of the Properties panel layout. */
export interface PropertyLayoutSource {
  sections(): Promise<PropertySectionRecord[]>;
  placements(): Promise<PropertyPlacementRecord[]>;
}

interface SectionRow {
  key: string;
  nature: string;
  position: number;
  labels: string;
  is_fallback: boolean;
}

interface PlacementRow {
  component: string;
  prop_key: string;
  section_key: string;
  position: number;
  advanced: boolean;
  visible_when: string | null;
  labels: string | null;
  help: string | null;
}

function jsonObject(text: string | null): Record<string, unknown> | null {
  if (text === null) return null;
  const value: unknown = JSON.parse(text);
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null; // narrowed to a plain object above
}

function localized(text: string | null): LocalizedText | null {
  const value = jsonObject(text);
  if (value === null) return null;
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

/** `property_section` and `component_property`: the layout of the Properties panel. */
export class PropertyLayoutRepository implements PropertyLayoutSource {
  public constructor(private readonly db: Database) {}

  public async sections(): Promise<PropertySectionRecord[]> {
    const rows = await this.db.query<SectionRow>(
      'select key, nature::text as nature, position, labels::text as labels, is_fallback from studio.property_section order by position',
    );
    return rows.map((row) => ({ key: row.key, nature: row.nature, position: row.position, labels: localized(row.labels) ?? {}, isFallback: row.is_fallback }));
  }

  public async placements(): Promise<PropertyPlacementRecord[]> {
    const rows = await this.db.query<PlacementRow>(
      `select component, prop_key, section_key, position, advanced, visible_when::text as visible_when, labels::text as labels, help::text as help
       from studio.component_property order by component, position`,
    );
    return rows.map((row) => ({
      component: row.component,
      prop: row.prop_key,
      section: row.section_key,
      position: row.position,
      advanced: row.advanced,
      visibleWhen: jsonObject(row.visible_when),
      labels: localized(row.labels),
      help: localized(row.help),
    }));
  }
}
