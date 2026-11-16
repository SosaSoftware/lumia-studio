import { shallowRef } from 'vue';
import { COMPONENT_GROUP_NAMES, componentCatalog } from '@lumia/packages/catalog';
import { rec } from '../../api/decode.ts';
import type { StudioApi } from '../../api/studio-api.ts';
import type { CatalogComponentInfo, CatalogInfo, PropertyPlacementInfo, PropertySectionInfo } from '../../api/types.ts';

/** Only section of the bundled catalog: without the API there is no layout, so every field goes in one section. */
const LOCAL_SECTION: PropertySectionInfo = { key: 'content', nature: 'content', position: 1, labels: { es: 'Propiedades', en: 'Properties' }, isFallback: true };

/** Fields of a slide, in the order the bundled catalog shows them. */
const LOCAL_SLIDE_FIELDS: readonly string[] = ['title', 'unlock', 'unlockElementId', 'durationS', 'startMode', 'startElementId', 'background', 'transition'];

/** Fields every element has, in the order the bundled catalog shows them. */
const LOCAL_ELEMENT_FIELDS: readonly string[] = ['x', 'y', 'w', 'h', 'entrance', 'appearsAtS', 'exit', 'disappearsAtS'];

function localPlacement(prop: string, index: number): PropertyPlacementInfo {
  return { prop, section: LOCAL_SECTION.key, position: index, advanced: false, visibleWhen: null, labels: null, help: null };
}

/** Top-level props the panel shows: every prop of the schema except the ones marked `hidden`. */
function visibleProps(schema: Record<string, unknown>): string[] {
  return Object.entries(rec(schema.properties))
    .filter(([, node]) => rec(node).hidden !== true)
    .map(([key]) => key);
}

/** Catalog bundled with the app; it covers the base subset when the API is not reachable. */
export function localCatalog(): CatalogInfo {
  return {
    sections: [LOCAL_SECTION],
    elementLayout: LOCAL_ELEMENT_FIELDS.map((prop, index) => localPlacement(prop, 1000 + index)),
    slideLayout: LOCAL_SLIDE_FIELDS.map((prop, index) => localPlacement(prop, 1000 + index)),
    components: componentCatalog.list().map(
      (definition): CatalogComponentInfo => ({
        key: definition.key,
        name: definition.name,
        group: definition.group,
        groupName: COMPONENT_GROUP_NAMES[definition.group],
        usage: definition.usage,
        propsSchema: { ...componentCatalog.jsonSchema(definition.key) },
        defaults: rec(definition.defaults),
        defaultSize: { ...definition.defaultSize },
        usesMedia: definition.usesMedia,
        isQuestion: definition.isQuestion,
        layout: visibleProps({ ...componentCatalog.jsonSchema(definition.key) }).map(localPlacement),
      }),
    ),
  };
}

export interface PaletteGroup {
  key: string;
  name: string;
  components: CatalogComponentInfo[];
}

/** Component catalog used by the palette, the forms and the editor; the API is the source and the bundled copy the fallback. */
export class CatalogStore {
  public readonly info = shallowRef<CatalogInfo>(localCatalog());

  public async load(api: StudioApi): Promise<void> {
    try {
      const loaded = await api.componentCatalog();
      if (loaded.components.length > 0) this.info.value = loaded;
    } catch {
      // The bundled catalog is equivalent for the base components, so the editor keeps working.
    }
  }

  public component(key: string): CatalogComponentInfo | undefined {
    return this.info.value.components.find((component) => component.key === key);
  }

  /** Whether the height of the component is the height of its content, so the editor sizes its frame to it. */
  public fitsContent(key: string): boolean {
    return componentCatalog.get(key)?.fitsContent === true;
  }

  /** Component groups in catalog order. */
  public groups(): PaletteGroup[] {
    const groups = new Map<string, PaletteGroup>();
    for (const component of this.info.value.components) {
      const group = groups.get(component.group) ?? { key: component.group, name: component.groupName, components: [] };
      group.components.push(component);
      groups.set(component.group, group);
    }
    return [...groups.values()];
  }
}
