import { z } from 'zod';
import { ACTIONS } from '../../auth/index.ts';
import { slideSummary, slideView } from '../class-data.ts';
import { json, list, num, optionalNum, optionalText, record, text, texts } from '../decode.ts';
import { findSlide, readDocument } from '../draft.ts';
import type { StudioGraphql } from '../studio-graphql.ts';
import type { StudioTool } from '../tool-definition.ts';
import { defineTool } from '../tool-definition.ts';
import { ToolError } from '../tool-error.ts';
import { nodeIdInput, slideIdInput } from './inputs.ts';

const MAX_PAGES = 20;
const MEDIA_PAGE_SIZE = 50;
const MEDIA_PREFIXES = { image: 'image/', video: 'video/', audio: 'audio/' } as const;

/** Reads every page of a paged field. */
async function allPages(studio: StudioGraphql, query: string, field: string, variables: Readonly<Record<string, unknown>> = {}): Promise<unknown[]> {
  const items: unknown[] = [];
  let nextToken: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const data = await studio.request(query, { ...variables, page: { nextToken } });
    const answer = record(data[field]);
    items.push(...list(answer.items));
    nextToken = optionalText(answer.nextToken);
    if (nextToken === null) break;
  }
  return items;
}

const getMyAccess = defineTool({
  name: 'get_my_access',
  description:
    'Rol de la persona en Studio, las acciones que ese rol le permite (por ejemplo documents.edit) y las tools de este MCP que puede usar, con el nombre que ve el modelo. Úsala para saber qué puede hacer antes de intentar un cambio.',
  action: ACTIONS.documentsView,
  input: z.object({}),
  run: async (_args, { studio, targets }) => {
    const me = record((await studio.request('query { me { userId email name role roleName actions } }')).me);
    const actions = texts(me.actions);
    const tools = targets.flatMap((target) => target.tools.filter((tool) => actions.includes(tool.action)).map((tool) => `${target.name}___${tool.name}`));
    return { name: text(me.name), email: text(me.email), role: { key: text(me.role), name: text(me.roleName) }, actions, tools };
  },
});

const listCategories = defineTool({
  name: 'list_categories',
  description: 'Categorías y subcategorías que la persona puede ver, con su grupo de menú (groupName, solo visual).',
  action: ACTIONS.documentsView,
  input: z.object({}),
  run: async (_args, { studio }) => {
    const items = await allPages(
      studio,
      'query($page: PageInput) { categories(page: $page) { items { id name displayName description groupName subcategories { id name displayName description groupName } } nextToken } }',
      'categories',
    );
    const named = (value: unknown): Record<string, unknown> => {
      const item = record(value);
      return { id: text(item.id), name: text(item.name), displayName: text(item.displayName), description: text(item.description), groupName: optionalText(item.groupName) };
    };
    return { categories: items.map((item) => ({ ...named(item), subcategories: list(record(item).subcategories).map(named) })) };
  },
});

const listTree = defineTool({
  name: 'list_tree',
  description:
    'Carpetas y clases de una subcategoría, en el orden del árbol, con su ruta lógica (por ejemplo fundamentos/que-es-la-ia.lumia) y el estado del contenido de cada clase: no_content, draft o published.',
  action: ACTIONS.documentsView,
  input: z.object({ subcategoryId: z.string().min(1).describe('Id de la subcategoría (list_categories).') }),
  run: async ({ subcategoryId }, { studio }) => {
    const nodes = (
      await allPages(
        studio,
        'query($filter: TreeNodeFilter!, $page: PageInput) { treeNodes(filter: $filter, page: $page) { items { id parentId kind name displayName description documentStatus currentVersion publishedVersion } nextToken } }',
        'treeNodes',
        { filter: { subcategoryId } },
      )
    ).map(record);
    const byId = new Map(nodes.map((node) => [text(node.id), node]));
    const pathOf = (node: Record<string, unknown>): string => {
      const parts = [text(node.name)];
      let parentId = optionalText(node.parentId);
      for (let depth = 0; parentId !== null && depth < 50; depth += 1) {
        const parent = byId.get(parentId);
        if (parent === undefined) break;
        parts.unshift(text(parent.name));
        parentId = optionalText(parent.parentId);
      }
      return parts.join('/');
    };
    return {
      nodes: nodes.map((node) => {
        const isClass = node.kind === 'class';
        return {
          id: text(node.id),
          parentId: optionalText(node.parentId),
          kind: text(node.kind),
          name: text(node.name),
          displayName: text(node.displayName),
          ...(text(node.description) === '' ? {} : { description: text(node.description) }),
          path: pathOf(node),
          ...(isClass ? { status: text(node.documentStatus, 'no_content'), currentVersion: optionalNum(node.currentVersion), publishedVersion: optionalNum(node.publishedVersion) } : {}),
        };
      }),
    };
  },
});

const getClass = defineTool({
  name: 'get_class',
  description:
    'Resumen de una clase: estado, versión que se edita y lista de diapositivas con sus componentes. Si la versión es la publicada, el primer cambio crea un borrador nuevo automáticamente.',
  action: ACTIONS.documentsView,
  input: z.object({ nodeId: nodeIdInput }),
  run: async ({ nodeId }, { studio }) => {
    const document = await readDocument(studio, nodeId);
    if (document === null) {
      return { nodeId, status: 'no_content', slides: [], note: 'La clase todavía no tiene contenido; add_slides crea su primera versión.' };
    }
    return {
      nodeId,
      documentId: document.id,
      status: document.status,
      currentVersion: document.currentVersion,
      publishedVersion: document.publishedVersion,
      editing: { versionId: document.editingVersion.id, number: document.editingVersion.number, status: document.editingVersion.status },
      slides: document.editingVersion.slides.map(slideSummary),
    };
  },
});

const getSlide = defineTool({
  name: 'get_slide',
  description: 'Una diapositiva completa de la versión que se edita: componentes con sus props y posición, narraciones, audios, pausas y comentarios.',
  action: ACTIONS.documentsView,
  input: z.object({ nodeId: nodeIdInput, slideId: slideIdInput }),
  run: async ({ nodeId, slideId }, { studio }) => {
    const document = await readDocument(studio, nodeId);
    if (document === null) throw ToolError.notFound('La clase todavía no tiene contenido.');
    return { slide: slideView(findSlide(document.editingVersion, slideId)) };
  },
});

const listComponents = defineTool({
  name: 'list_components',
  description:
    'Catálogo de Studio. Sin keys: todos los componentes, con su uso. Con keys: el esquema de props, los valores por defecto y el tamaño de esos componentes, para armar props válidas.',
  action: ACTIONS.documentsView,
  input: z.object({ keys: z.array(z.string().min(1)).max(28).optional().describe('Llaves de los componentes cuyo esquema necesitas, por ejemplo ["title", "multiple_choice"].') }),
  run: async ({ keys }, { studio }) => {
    const catalog = record(
      (
        await studio.request(
          'query { componentCatalog { components { key name group groupName usage propsSchema defaults defaultSize { w h } usesMedia isQuestion } } }',
        )
      ).componentCatalog,
    );
    const components = list(catalog.components).map(record);
    if (keys === undefined || keys.length === 0) {
      return {
        components: components.map((component) => ({
          key: text(component.key),
          name: text(component.name),
          group: text(component.groupName),
          usage: text(component.usage),
          usesMedia: component.usesMedia === true,
          isQuestion: component.isQuestion === true,
        })),
        note: 'Pide con keys los componentes que vas a usar para ver su esquema de props.',
      };
    }
    const wanted = components.filter((component) => keys.includes(text(component.key)));
    const unknown = keys.filter((key) => !wanted.some((component) => text(component.key) === key));
    return {
      components: wanted.map((component) => {
        const size = record(component.defaultSize);
        return {
          key: text(component.key),
          name: text(component.name),
          usage: text(component.usage),
          propsSchema: json(component.propsSchema),
          defaults: json(component.defaults),
          defaultSize: { w: num(size.w), h: num(size.h) },
          usesMedia: component.usesMedia === true,
        };
      }),
      ...(unknown.length === 0 ? {} : { unknownKeys: unknown }),
    };
  },
});

const searchMedia = defineTool({
  name: 'search_media',
  description: 'Busca en la biblioteca de medios de una categoría. Para poner un medio en un componente, usa su id en props.mediaId (o items[].mediaId en una galería).',
  action: ACTIONS.documentsView,
  input: z.object({
    categoryId: z.string().min(1).describe('Id de la categoría de la clase (list_categories).'),
    text: z.string().min(1).optional().describe('Texto que debe aparecer en el nombre del archivo.'),
    type: z.enum(['image', 'video', 'audio']).optional().describe('Tipo de medio.'),
    nextToken: z.string().min(1).optional().describe('Para la página siguiente, el nextToken de la respuesta anterior.'),
  }),
  run: async (args, { studio }) => {
    const filter = { categoryId: args.categoryId, ...(args.text === undefined ? {} : { text: args.text }), ...(args.type === undefined ? {} : { mimePrefix: MEDIA_PREFIXES[args.type] }) };
    const answer = record(
      (
        await studio.request('query($filter: MediaFilter!, $page: PageInput) { mediaLibrary(filter: $filter, page: $page) { items { id name mimeType sizeBytes createdAt } nextToken } }', {
          filter,
          page: { limit: MEDIA_PAGE_SIZE, nextToken: args.nextToken ?? null },
        })
      ).mediaLibrary,
    );
    return {
      items: list(answer.items)
        .map(record)
        .map((item) => ({ id: text(item.id), name: text(item.name), mimeType: text(item.mimeType), sizeBytes: num(item.sizeBytes), createdAt: text(item.createdAt) })),
      nextToken: optionalText(answer.nextToken),
    };
  },
});

const listVoices = defineTool({
  name: 'list_voices',
  description: 'Voces de Amazon Polly disponibles para narrar. Usa el id de la voz en save_narration o generate_narration_audio.',
  action: ACTIONS.documentsView,
  input: z.object({ languageCode: z.string().min(2).optional().describe('Prefijo del idioma, por ejemplo es para todas las variantes de español.') }),
  run: async ({ languageCode }, { studio }) => {
    const voices = await allPages(
      studio,
      'query($filter: VoiceFilter, $page: PageInput) { narrationVoices(filter: $filter, page: $page) { items { id name gender languageCode } nextToken } }',
      'narrationVoices',
      { filter: languageCode === undefined ? null : { languageCode } },
    );
    return { voices: voices.map(record).map((voice) => ({ id: text(voice.id), name: text(voice.name), gender: text(voice.gender), languageCode: text(voice.languageCode) })) };
  },
});

export const READ_TOOLS: readonly StudioTool[] = [getMyAccess, listCategories, listTree, getClass, getSlide, listComponents, searchMedia, listVoices];
