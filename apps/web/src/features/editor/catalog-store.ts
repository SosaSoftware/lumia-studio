import { shallowRef } from 'vue';
import { COMPONENT_GROUP_NAMES, componentCatalog } from '@lumia/packages/catalog';
import { rec } from '../../api/decode.ts';
import type { StudioApi } from '../../api/studio-api.ts';
import type { CatalogComponentInfo, CatalogInfo } from '../../api/types.ts';

/** Catalog bundled with the app; it covers the base subset when the API is not reachable. */
export function localCatalog(): CatalogInfo {
  return {
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
