import { nextTick } from 'vue';
import { isPaletteGroup, openGroup, openPanel, PANEL_NAMES, panels } from '../../composables/panels.ts';
import type { PaletteGroup, PanelName } from '../../composables/panels.ts';
import type { WorkspaceStore } from '../workspace/workspace-store.ts';
import { parseStatusFilter } from '../workspace/workspace-store.ts';

/** A frontend tool as AG-UI declares it to the agent: the web runs it for the person when Lumi asks. */
export interface ToolDeclaration {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

const text = (description: string): Record<string, unknown> => ({ type: 'string', minLength: 1, description });

export const TOOL_DECLARATIONS: readonly ToolDeclaration[] = [
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
      properties: { panel: { type: 'string', enum: [...PANEL_NAMES], description: 'Panel que se abre' } },
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
    description: 'Pide a la persona que confirme los cambios antes de ejecutarlos. Lista cada llamada con su herramienta y sus argumentos exactos.',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', minLength: 1, maxLength: 300, description: 'Pregunta de confirmación en una frase.' },
        changes: {
          type: 'array',
          minItems: 1,
          maxItems: 20,
          description: 'Un elemento por cada llamada que ejecutarás si la persona confirma.',
          items: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                minLength: 1,
                description: 'Nombre exacto de la herramienta que ejecutarás, por ejemplo studio-slides___delete_slide.',
              },
              summary: { type: 'string', minLength: 1, maxLength: 300, description: 'Qué cambia, en el idioma de la persona.' },
              arguments: { type: 'object', description: 'Argumentos exactos que enviarás a la herramienta.' },
              targets: {
                type: 'array',
                maxItems: 20,
                description: 'Diapositivas, componentes o elementos de la línea de tiempo existentes que el cambio afecta.',
                items: {
                  type: 'object',
                  properties: {
                    kind: { type: 'string', enum: ['slide', 'element', 'narration', 'audio_clip', 'pause'] },
                    id: { type: 'string', minLength: 1, description: 'Id que recibirá la herramienta.' },
                    label: { type: 'string', minLength: 1, maxLength: 120, description: 'Cómo lo ve la persona, por ejemplo el título de la diapositiva.' },
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

const TOOL_NAMES = new Set(TOOL_DECLARATIONS.map((tool) => tool.name));

export function isFrontendTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

/** What Lumi is doing while a tool runs, next to the "Pulso" animation. Keys are the tool names without the gateway target. */
const ACTIVITY: Readonly<Record<string, string>> = {
  get_my_access: 'Revisando tus permisos…',
  list_categories: 'Revisando las categorías…',
  list_tree: 'Buscando en el árbol…',
  get_class: 'Leyendo la clase…',
  get_slide: 'Revisando la diapositiva…',
  list_components: 'Revisando los componentes…',
  search_media: 'Buscando en la biblioteca…',
  list_voices: 'Revisando las voces…',
  add_slides: 'Agregando diapositivas…',
  update_slide: 'Cambiando la diapositiva…',
  move_slide: 'Moviendo la diapositiva…',
  duplicate_slide: 'Duplicando la diapositiva…',
  delete_slide: 'Borrando la diapositiva…',
  add_element: 'Agregando un componente…',
  update_element: 'Cambiando un componente…',
  delete_element: 'Borrando un componente…',
  save_narration: 'Guardando la narración…',
  generate_narration_audio: 'Generando el audio de la narración…',
  delete_narration: 'Borrando la narración…',
  save_audio_clip: 'Ajustando el audio…',
  delete_audio_clip: 'Quitando el audio…',
  save_pause: 'Ajustando la pausa…',
  delete_pause: 'Borrando la pausa…',
  open_class: 'Abriendo la clase…',
  select_slide: 'Seleccionando la diapositiva…',
  select_element: 'Seleccionando el elemento…',
  open_panel: 'Abriendo el panel…',
  highlight_element: 'Señalando en la pantalla…',
  filter_tree: 'Filtrando el árbol…',
  start_preview: 'Abriendo la vista previa…',
  confirm_change: 'Esperando tu confirmación…',
  knowledge___Retrieve: 'Consultando la base de conocimiento…',
};

/** Tools of the Studio MCP that save changes to a class. */
const CLASS_CHANGES = new Set([
  'add_slides',
  'update_slide',
  'move_slide',
  'duplicate_slide',
  'delete_slide',
  'add_element',
  'update_element',
  'delete_element',
  'save_narration',
  'generate_narration_audio',
  'delete_narration',
  'save_audio_clip',
  'delete_audio_clip',
  'save_pause',
  'delete_pause',
]);

/** Tool name without the gateway target: AgentCore Gateway names tools `<target>___<tool>`. */
export function baseToolName(name: string): string {
  const cut = name.indexOf('___');
  return cut === -1 ? name : name.slice(cut + 3);
}

export function activityLabel(name: string): string {
  return ACTIVITY[name] ?? ACTIVITY[baseToolName(name)] ?? 'Lumi está trabajando…';
}

/** Whether a tool of Lumi saved a change to a class, so the editor has to show it. */
export function changesClass(name: string): boolean {
  return CLASS_CHANGES.has(baseToolName(name));
}

export interface ContextEntry {
  readonly description: string;
  readonly value: string;
}

/** The signed-in person as the context names them. Lumi binds sessions to the `sub` of the verified token, not to this. */
export interface ContextUser {
  readonly sub: string;
  readonly name: string;
  readonly role: string;
}

/** Screen context sent with every run: person, page, scope, open class, selection and panels. */
export function buildContext(workspace: WorkspaceStore, user: ContextUser | null = null): ContextEntry[] {
  const session = workspace.session;
  const entries: ContextEntry[] = [{ description: 'platform', value: '"studio"' }];
  if (user !== null) entries.push({ description: 'user', value: JSON.stringify(user) });
  const node = session.state.classNode;
  const scope = {
    categoryId: workspace.category.value?.id ?? null,
    category: workspace.category.value?.displayName ?? null,
    subcategoryId: workspace.subcategory.value?.id ?? null,
    subcategory: workspace.subcategory.value?.displayName ?? null,
    classes: workspace.countByStatus(),
  };
  if (node === null) {
    entries.push({ description: 'page', value: '"empty"' });
    entries.push({ description: 'scope', value: JSON.stringify(scope) });
  } else {
    entries.push({ description: 'page', value: '"editor"' });
    entries.push({ description: 'scope', value: JSON.stringify(scope) });
    const record: Record<string, unknown> = {
      nodeId: node.id,
      name: node.name,
      displayName: node.displayName,
      description: node.description,
      path: workspace.pathOf(node.id).map((item) => item.displayName),
      documentStatus: node.documentStatus,
    };
    const document = session.state.document;
    if (document !== null) {
      record.documentId = document.id;
      record.versionId = document.editingVersion.id;
      record.versionNumber = document.editingVersion.number;
      record.versionStatus = document.editingVersion.status;
      record.slideCount = session.state.slides.length;
    }
    entries.push({ description: 'record', value: JSON.stringify(record) });
    const slide = session.currentSlide;
    const element = session.selectedElement;
    if (slide !== null) {
      const selection: Record<string, unknown> = { slideId: slide.id, slidePosition: slide.position, slideType: slide.type, slideTitle: slide.title };
      if (element !== null) {
        selection.elementId = element.id;
        selection.elementComponent = element.component;
        selection.elementName = element.name;
      }
      const clip = session.state.selectedClip;
      if (clip !== null) selection.timeline = clip;
      entries.push({ description: 'selection', value: JSON.stringify(selection) });
    }
  }
  entries.push({ description: 'panel', value: JSON.stringify({ left: panels.left, right: panels.right, bottom: panels.bottom }) });
  return entries;
}

export type ToolArgs = Record<string, unknown>;

const HIGHLIGHT_MS = 4000;
let highlightTimer: ReturnType<typeof setTimeout> | undefined;

function clearHighlight(): void {
  document.querySelectorAll('[data-lumi-highlight]').forEach((element) => {
    element.removeAttribute('data-lumi-highlight');
  });
}

/** Opens what a control needs to be visible: a component group of the palette, for example. */
function revealTarget(target: string, workspace: WorkspaceStore): void {
  const groupMatch = /^(?:palette|activity)-group-(.+)$/.exec(target);
  const itemMatch = /^palette-item-(?:slide-)?(.+)$/.exec(target);
  let group: PaletteGroup | undefined;
  if (groupMatch !== null && isPaletteGroup(groupMatch[1])) group = groupMatch[1];
  else if (target.startsWith('palette-item-slide-')) group = 'slides';
  else if (itemMatch !== null) {
    const component = workspace.catalog.component(itemMatch[1] ?? '');
    if (component !== undefined && isPaletteGroup(component.group)) group = component.group;
  } else if (target === 'activity-components') group = panels.lastGroup;
  if (group !== undefined && workspace.activeClass.value !== null && !target.startsWith('activity-')) openGroup(group);
  if (target === 'slides-add' || target.startsWith('slide-thumb-')) panels.bottom = 'slides';
}

async function highlight(target: string, workspace: WorkspaceStore): Promise<boolean> {
  clearHighlight();
  revealTarget(target, workspace);
  await nextTick();
  const element = document.querySelector(`[data-testid="${CSS.escape(target)}"]`) ?? document.querySelector(`[data-testid="element-${CSS.escape(target)}"]`) ?? document.getElementById(target);
  if (element === null) return false;
  element.setAttribute('data-lumi-highlight', 'true');
  element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  clearTimeout(highlightTimer);
  highlightTimer = setTimeout(clearHighlight, HIGHLIGHT_MS);
  return true;
}

function isPanelName(value: unknown): value is PanelName {
  return PANEL_NAMES.some((name) => name === value);
}

/** Runs a frontend tool that needs no decision from the person and returns its result for Lumi. */
export async function executeSimpleTool(name: string, args: ToolArgs, workspace: WorkspaceStore): Promise<unknown> {
  const session = workspace.session;
  switch (name) {
    case 'open_class': {
      const opened = await workspace.openClass(typeof args.nodeId === 'string' ? args.nodeId : '');
      return opened ? { opened: true } : { opened: false, error: 'La clase no existe en el árbol que la persona está viendo.' };
    }
    case 'select_slide': {
      const slideId = typeof args.slideId === 'string' ? args.slideId : '';
      if (!session.state.slides.some((slide) => slide.id === slideId)) return { selected: false, error: 'La diapositiva no está en la clase abierta.' };
      session.selectSlide(slideId);
      return { selected: true };
    }
    case 'select_element': {
      const elementId = typeof args.elementId === 'string' ? args.elementId : '';
      const slide = session.state.slides.find((candidate) => candidate.elements.some((element) => element.id === elementId));
      if (slide === undefined) return { selected: false, error: 'El elemento no está en la clase abierta.' };
      session.selectSlide(slide.id);
      session.selectElement(elementId);
      return { selected: true };
    }
    case 'open_panel': {
      const panel = args.panel;
      if (!isPanelName(panel)) return { opened: false, error: 'Ese panel no existe.' };
      const needsClass = panel === 'components' || panel === 'slides' || panel === 'timeline' || panel === 'properties' || panel === 'comments';
      if (needsClass && workspace.activeClass.value === null) return { opened: false, error: 'Primero hay que abrir una clase.' };
      openPanel(panel);
      return { opened: true };
    }
    case 'highlight_element': {
      const highlighted = await highlight(typeof args.target === 'string' ? args.target : '', workspace);
      return highlighted ? { highlighted: true } : { highlighted: false, error: 'No encontré ese control en la pantalla.' };
    }
    case 'filter_tree': {
      const status = parseStatusFilter(args.status);
      workspace.setFilters({
        ...(status === undefined ? {} : { status }),
        ...(typeof args.text === 'string' ? { text: args.text } : {}),
      });
      panels.left = 'explorer';
      return { applied: true };
    }
    case 'start_preview': {
      if (session.state.slides.length === 0) return { started: false, error: 'La clase todavía no tiene diapositivas.' };
      if (typeof args.slideId === 'string' && session.state.slides.some((slide) => slide.id === args.slideId)) session.selectSlide(args.slideId);
      workspace.previewOpen.value = true;
      return { started: true };
    }
    default:
      return { error: `Herramienta desconocida: ${name}` };
  }
}
