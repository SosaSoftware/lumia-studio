import type { Context, Tool } from '@ag-ui/core';

const text = (description: string): Record<string, unknown> => ({ type: 'string', minLength: 1, description });

/**
 * The frontend tools that the web of Lumia Studio declares on each run (`apps/web/src/features/lumi/frontend-tools.ts`),
 * with `confirm_change` in the contract agreed for Lumi: each change carries the exact tool and arguments.
 */
export const STUDIO_FRONTEND_TOOLS: readonly Tool[] = [
  {
    name: 'open_class',
    description: 'Abre una clase del árbol que la persona está viendo en el editor de Lumia Studio.',
    parameters: { type: 'object', properties: { nodeId: text('Id del nodo de la clase en el árbol') }, required: ['nodeId'] },
  },
  {
    name: 'select_slide',
    description: 'Selecciona una diapositiva de la clase abierta.',
    parameters: { type: 'object', properties: { slideId: text('Id de la diapositiva') }, required: ['slideId'] },
  },
  {
    name: 'select_element',
    description: 'Selecciona un elemento de la diapositiva abierta.',
    parameters: { type: 'object', properties: { elementId: text('Id del elemento') }, required: ['elementId'] },
  },
  {
    name: 'open_panel',
    description: 'Abre un panel de Lumia Studio.',
    parameters: {
      type: 'object',
      properties: { panel: { type: 'string', enum: ['explorer', 'components', 'slides', 'timeline', 'properties', 'comments', 'lumi'], description: 'Panel que se abre' } },
      required: ['panel'],
    },
  },
  {
    name: 'highlight_element',
    description: 'Resalta un elemento de la diapositiva o un control de la interfaz para guiar a la persona.',
    parameters: { type: 'object', properties: { target: text('Id de un elemento o llave de un control de la interfaz') }, required: ['target'] },
  },
  {
    name: 'filter_tree',
    description: 'Filtra el árbol que la persona está viendo por estado del contenido o por texto.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['all', 'no_content', 'draft', 'published'], description: 'Estado del contenido de la clase' },
        text: { type: 'string', description: 'Texto a buscar en los nombres y descripciones' },
      },
    },
  },
  {
    name: 'start_preview',
    description: 'Inicia la vista previa de la clase abierta, desde una diapositiva si se indica.',
    parameters: { type: 'object', properties: { slideId: { type: 'string', description: 'Diapositiva desde la que inicia' } } },
  },
  {
    name: 'confirm_change',
    description:
      'Pide a la persona que confirme los cambios antes de hacerlos. Cada cambio lleva la herramienta exacta y los argumentos exactos que se ejecutarán si la persona acepta.',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', minLength: 1, maxLength: 300, description: 'Pregunta de confirmación en una frase.' },
        changes: {
          type: 'array',
          minItems: 1,
          maxItems: 20,
          description: 'Los cambios que se harán, uno por llamada.',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string', minLength: 1, description: 'Nombre exacto de la herramienta, por ejemplo studio-slides___delete_slide.' },
              summary: { type: 'string', minLength: 1, maxLength: 200, description: 'Qué cambia, como lo entiende la persona.' },
              arguments: { type: 'object', description: 'Los argumentos exactos con los que se llamará la herramienta.' },
              targets: {
                type: 'array',
                maxItems: 20,
                description: 'Lo que ya existe y se va a cambiar o borrar.',
                items: {
                  type: 'object',
                  properties: {
                    kind: { type: 'string', enum: ['slide', 'element', 'narration', 'audio_clip', 'pause'] },
                    id: { type: 'string', minLength: 1 },
                    label: { type: 'string', minLength: 1, maxLength: 120 },
                  },
                  required: ['kind', 'id', 'label'],
                },
              },
            },
            required: ['action', 'summary', 'arguments'],
          },
        },
      },
      required: ['message', 'changes'],
    },
  },
];

/** What the person sees, as the web describes it in the screen context. */
export interface ScreenState {
  readonly user: { readonly sub: string; readonly name: string; readonly role: string };
  readonly categoryId: string;
  readonly subcategoryId: string;
  /** The open class, or null on the empty page. */
  readonly openClass: { readonly nodeId: string; readonly displayName: string; readonly slideCount: number } | null;
  readonly selection?: Readonly<Record<string, unknown>>;
}

/** The screen context entries of the web (`buildContext`), for a given screen. */
export function studioContext(screen: ScreenState): Context[] {
  const entries: Context[] = [
    { description: 'platform', value: '"studio"' },
    { description: 'user', value: JSON.stringify(screen.user) },
    { description: 'page', value: screen.openClass === null ? '"empty"' : '"editor"' },
    {
      description: 'scope',
      value: JSON.stringify({ categoryId: screen.categoryId, category: 'Pruebas', subcategoryId: screen.subcategoryId, subcategory: 'Pruebas', classes: {} }),
    },
  ];
  if (screen.openClass !== null) {
    const { nodeId, displayName, slideCount } = screen.openClass;
    entries.push({
      description: 'record',
      value: JSON.stringify({ nodeId, name: 'clase.lumia', displayName, description: '', path: ['Pruebas', displayName], documentStatus: slideCount === 0 ? 'no_content' : 'draft', slideCount }),
    });
    if (screen.selection !== undefined) {
      entries.push({ description: 'selection', value: JSON.stringify(screen.selection) });
    }
  }
  entries.push({ description: 'panel', value: JSON.stringify({ left: 'explorer', right: 'lumi', bottom: 'slides' }) });
  return entries;
}
