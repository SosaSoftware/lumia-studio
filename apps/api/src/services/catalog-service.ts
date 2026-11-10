import { COMPONENT_GROUP_NAMES, componentCatalog } from '@lumia/packages/catalog';
import type { ComponentCatalog } from '@lumia/packages/catalog';

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
}

export interface ComponentCatalogDto {
  components: CatalogComponentDto[];
}

/** Presents the component catalog, with `propsSchema` and `defaults` as JSON, for the editor and Lumi. */
export class CatalogService {
  public constructor(private readonly catalog: ComponentCatalog = componentCatalog) {}

  public describe(): ComponentCatalogDto {
    return {
      components: this.catalog.list().map((definition) => ({
        key: definition.key,
        name: definition.name,
        group: definition.group,
        groupName: COMPONENT_GROUP_NAMES[definition.group],
        usage: definition.usage,
        propsSchema: this.catalog.jsonSchema(definition.key) ?? {},
        defaults: definition.defaults,
        defaultSize: { w: definition.defaultSize.w, h: definition.defaultSize.h },
        usesMedia: definition.usesMedia,
        isQuestion: definition.isQuestion,
      })),
    };
  }
}
