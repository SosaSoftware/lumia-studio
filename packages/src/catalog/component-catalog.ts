import { z } from 'zod';
import type { ComponentDefinition } from './component-definition.ts';
import { COMPONENT_GROUP_NAMES } from './component-definition.ts';
import type { Geometry } from './geometry.ts';
import { geometryErrors } from './geometry.ts';
import type { SlideTypeDefinition } from './slide-types.ts';
import { SLIDE_TYPES } from './slide-types.ts';

export interface CatalogIssue {
  path: string;
  message: string;
}

export type PropsValidation =
  | { ok: true; props: Record<string, unknown> }
  | { ok: false; errors: CatalogIssue[] };

/** Short description of a component, sized for a model prompt. */
export interface CompactComponent {
  key: string;
  name: string;
  group: string;
  usage: string;
  props: string;
}

export interface ElementCandidate {
  component: string;
  props: unknown;
  geometry?: Geometry;
}

interface JsonSchemaNode {
  type?: string | string[];
  enum?: unknown[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  items?: JsonSchemaNode;
  properties?: Record<string, JsonSchemaNode>;
  anyOf?: JsonSchemaNode[];
  format?: string;
  description?: string;
}

/**
 * Registry of Studio components and slide types.
 * Validates element props and geometry, and exports JSON Schema and compact descriptions for Lumi.
 */
export class ComponentCatalog {
  private readonly byKey: ReadonlyMap<string, ComponentDefinition>;

  public constructor(
    private readonly definitions: readonly ComponentDefinition[],
    public readonly slideTypes: readonly SlideTypeDefinition[] = SLIDE_TYPES,
  ) {
    this.byKey = new Map(definitions.map((definition) => [definition.key, definition]));
  }

  public list(): readonly ComponentDefinition[] {
    return this.definitions;
  }

  public get(key: string): ComponentDefinition | undefined {
    return this.byKey.get(key);
  }

  public has(key: string): boolean {
    return this.byKey.has(key);
  }

  /** Validates props against the component schema; unknown keys are rejected. */
  public validateProps(key: string, props: unknown): PropsValidation {
    const definition = this.byKey.get(key);
    if (!definition) {
      return { ok: false, errors: [{ path: 'component', message: `El componente "${key}" no existe en el catálogo.` }] };
    }
    const schema = definition.propsSchema instanceof z.ZodObject ? definition.propsSchema.strict() : definition.propsSchema;
    const result = schema.safeParse(props);
    if (result.success) {
      return { ok: true, props: result.data as Record<string, unknown> };
    }
    return {
      ok: false,
      errors: result.error.issues.map((issue) => ({
        path: ['props', ...issue.path.map(String)].join('.'),
        message: issue.message,
      })),
    };
  }

  /** Whether the component holds one medium in a top-level `mediaId` prop (and not one per item, as the gallery). */
  public hasMediaField(key: string): boolean {
    const schema = this.byKey.get(key)?.propsSchema;
    return schema instanceof z.ZodObject && 'mediaId' in schema.shape;
  }

  /** Every media id that the props reference, at any depth (for example `items[].mediaId` of a gallery). */
  public mediaIds(key: string, props: unknown): string[] {
    if (this.byKey.get(key)?.usesMedia !== true) return [];
    const found = new Set<string>();
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) {
        for (const item of value) visit(item);
      } else if (typeof value === 'object' && value !== null) {
        for (const [name, nested] of Object.entries(value)) {
          if (name === 'mediaId' && typeof nested === 'string' && nested !== '') found.add(nested);
          else visit(nested);
        }
      }
    };
    visit(props);
    return [...found];
  }

  /** Fills missing top-level props with the component defaults, then validates. */
  public withDefaults(key: string, props: Record<string, unknown>): PropsValidation {
    const definition = this.byKey.get(key);
    if (!definition) return this.validateProps(key, props);
    return this.validateProps(key, { ...(definition.defaults as Record<string, unknown>), ...props });
  }

  /** Validates an element: known component, valid props and, when present, geometry inside the slide. */
  public validateElement(candidate: ElementCandidate): PropsValidation {
    const props = this.validateProps(candidate.component, candidate.props);
    const geometry = candidate.geometry ? geometryErrors(candidate.geometry).map((message) => ({ path: 'geometry', message })) : [];
    if (props.ok && geometry.length === 0) return props;
    return { ok: false, errors: [...(props.ok ? [] : props.errors), ...geometry] };
  }

  public jsonSchema(key: string): Record<string, unknown> | undefined {
    const definition = this.byKey.get(key);
    return definition ? (z.toJSONSchema(definition.propsSchema, { unrepresentable: 'any' })) : undefined;
  }

  public compact(): CompactComponent[] {
    return this.definitions.map((definition) => ({
      key: definition.key,
      name: definition.name,
      group: COMPONENT_GROUP_NAMES[definition.group],
      usage: definition.usage,
      props: this.summarizeProps(this.jsonSchema(definition.key) as JsonSchemaNode),
    }));
  }

  private summarizeProps(schema: JsonSchemaNode): string {
    const properties = schema.properties ?? {};
    return Object.entries(properties)
      .map(([name, node]) => `${name}: ${this.summarizeNode(node)}`)
      .join('; ');
  }

  private summarizeNode(node: JsonSchemaNode): string {
    if (node.anyOf) return node.anyOf.map((option) => this.summarizeNode(option)).join(' | ');
    if (node.enum) return node.enum.map(String).join('|');
    if (node.type === 'array' && node.items) {
      const inner = node.items.properties ? `{ ${this.summarizeProps(node.items)} }` : this.summarizeNode(node.items);
      return `lista de ${inner} (${String(node.minItems ?? 0)}-${String(node.maxItems ?? 'n')})`;
    }
    if (node.type === 'string') {
      if (node.format === 'uuid') return 'uuid';
      return node.maxLength !== undefined ? `texto (máx ${String(node.maxLength)})` : 'texto';
    }
    if (node.type === 'integer' || node.type === 'number') {
      return `número (${String(node.minimum ?? '')}-${String(node.maximum ?? '')})`;
    }
    if (node.type === 'boolean') return 'true|false';
    if (node.type === 'null') return 'null';
    return 'valor';
  }
}
