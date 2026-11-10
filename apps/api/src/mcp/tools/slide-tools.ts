import { z } from 'zod';
import { ADVANCE_MODES, DEFAULT_SLIDE_ADVANCE, DEFAULT_SLIDE_BACKGROUND, DEFAULT_SLIDE_DURATION_S, SLIDE_TITLE_MAX_LENGTH, THEME_COLOR_KEYS, componentCatalog, slideLayoutEngine } from '@lumia/packages/catalog';
import { ACTIONS } from '../../auth/index.ts';
import { ENTRANCES, TRANSITIONS } from '../../domain/enums.ts';
import { SLIDE_FIELDS, decodeSlide, slideSummary } from '../class-data.ts';
import { list, num, record, text } from '../decode.ts';
import { draftNotice, findSlide, openDraft } from '../draft.ts';
import type { StudioTool } from '../tool-definition.ts';
import { defineTool } from '../tool-definition.ts';
import { ToolError } from '../tool-error.ts';
import { geometryInput, nodeIdInput, propsInput, secondsInput, slideIdInput } from './inputs.ts';

const draftElementInput = z.object({
  component: z.string().min(1).describe('Llave del componente (list_components).'),
  name: z.string().trim().min(1).optional().describe('Nombre en la línea de tiempo; por defecto, el del componente.'),
  ...geometryInput,
  appearsAtS: secondsInput.optional().describe('Segundo en que aparece.'),
  entrance: z.enum(ENTRANCES).optional().describe('Animación de entrada.'),
  props: propsInput.optional().describe('Props del componente; lo que falte toma sus valores por defecto.'),
});

const draftSlideInput = z.object({
  title: z.string().trim().min(1).max(SLIDE_TITLE_MAX_LENGTH).describe(`Título de la diapositiva, de hasta ${String(SLIDE_TITLE_MAX_LENGTH)} caracteres.`),
  background: z.enum(THEME_COLOR_KEYS).optional().describe(`Color de fondo del tema; por defecto, ${DEFAULT_SLIDE_BACKGROUND}.`),
  durationS: z.number().positive().optional().describe(`Duración en segundos; por defecto, ${String(DEFAULT_SLIDE_DURATION_S)}.`),
  transition: z.enum(TRANSITIONS).optional().describe('Transición al entrar a la diapositiva; por defecto, none.'),
  advance: z.enum(ADVANCE_MODES).optional().describe(`auto: al terminar su tiempo; click: con un clic; on_complete: al completar sus preguntas. Por defecto, ${DEFAULT_SLIDE_ADVANCE}; usa on_complete en las diapositivas con preguntas.`),
  elements: z
    .array(draftElementInput)
    .optional()
    .describe('Componentes de la diapositiva. Sin posición se acomodan solos: el título arriba y el resto debajo. Si no se indican, la diapositiva queda en blanco.'),
});

type DraftSlideSpec = z.output<typeof draftSlideInput>;
type DraftElementSpec = z.output<typeof draftElementInput>;

/** Builds the `DraftSlideInput` of one slide: catalog defaults, validated props and their layout. */
function buildDraftSlide(spec: DraftSlideSpec, slideIndex: number): Record<string, unknown> {
  const requested: DraftElementSpec[] = spec.elements ?? [];
  const placed = slideLayoutEngine.place(requested.map((element) => ({ component: element.component })));
  const elements = requested.map((element, elementIndex) => {
    const label = `Diapositiva ${String(slideIndex + 1)}, componente ${String(elementIndex + 1)} (${element.component})`;
    const definition = componentCatalog.get(element.component);
    if (definition === undefined) throw ToolError.invalidInput(`${label}: no existe en el catálogo; usa list_components.`);
    const props = componentCatalog.withDefaults(element.component, element.props ?? {});
    if (!props.ok) throw ToolError.invalidInput(`${label}: ${props.errors.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`);
    const place = placed[elementIndex];
    return {
      component: element.component,
      name: element.name ?? definition.name,
      x: element.x ?? place?.x ?? 0,
      y: element.y ?? place?.y ?? 0,
      w: element.w ?? place?.w ?? definition.defaultSize.w,
      h: element.h ?? place?.h ?? definition.defaultSize.h,
      z: element.z ?? place?.z ?? elementIndex + 1,
      appearsAtS: element.appearsAtS ?? place?.appearsAtS ?? 0,
      ...(element.entrance === undefined ? {} : { entrance: element.entrance }),
      props: JSON.stringify(props.props),
    };
  });
  return {
    title: spec.title,
    ...(spec.background === undefined ? {} : { background: spec.background }),
    ...(spec.durationS === undefined ? {} : { durationS: spec.durationS }),
    ...(spec.transition === undefined ? {} : { transition: spec.transition }),
    ...(spec.advance === undefined ? {} : { advance: spec.advance }),
    elements,
  };
}

const addSlides = defineTool({
  name: 'add_slides',
  description:
    'Agrega una o varias diapositivas, con sus componentes, a la clase. Crea el contenido de una clase vacía o el borrador de una publicada si hace falta. Valida las props contra el catálogo antes de guardar.',
  action: ACTIONS.documentsEdit,
  input: z.object({
    nodeId: nodeIdInput,
    afterPosition: z.number().int().min(0).optional().describe('Agrega después de esta posición (0 para el inicio). Sin valor, al final.'),
    slides: z.array(draftSlideInput).min(1).describe('Diapositivas a agregar, en orden.'),
  }),
  run: async ({ nodeId, afterPosition, slides }, { studio }) => {
    const drafts = slides.map(buildDraftSlide);
    const session = await openDraft(studio, nodeId);
    const created = list(
      (
        await studio.request(
          'mutation($v: ID!, $after: Int, $slides: [DraftSlideInput!]!) { applySlidesDraft(versionId: $v, afterPosition: $after, slides: $slides) { id position title elements { id component name } } }',
          { v: session.version.id, after: afterPosition ?? null, slides: drafts },
        )
      ).applySlidesDraft,
    ).map(record);
    return {
      versionId: session.version.id,
      slides: created.map((slide) => ({
        id: text(slide.id),
        position: num(slide.position),
        title: text(slide.title),
        elements: list(slide.elements)
          .map(record)
          .map((element) => ({ id: text(element.id), component: text(element.component), name: text(element.name) })),
      })),
      ...draftNotice(session),
    };
  },
});

const updateSlide = defineTool({
  name: 'update_slide',
  description: 'Cambia datos de una diapositiva: título, fondo, duración, transición o modo de avance. Solo cambia lo que indiques.',
  action: ACTIONS.documentsEdit,
  input: z.object({
    nodeId: nodeIdInput,
    slideId: slideIdInput,
    title: z.string().trim().min(1).max(SLIDE_TITLE_MAX_LENGTH).optional().describe(`Título de la diapositiva, de hasta ${String(SLIDE_TITLE_MAX_LENGTH)} caracteres.`),
    background: z.enum(THEME_COLOR_KEYS).optional(),
    durationS: z.number().positive().optional().describe('Duración en segundos.'),
    transition: z.enum(TRANSITIONS).optional().describe('Transición al entrar a la diapositiva.'),
    advance: z.enum(ADVANCE_MODES).optional().describe('auto: al terminar su tiempo; click: con un clic; on_complete: al completar sus preguntas.'),
  }),
  run: async ({ nodeId, slideId, ...changes }, { studio }) => {
    if (Object.keys(changes).length === 0) throw ToolError.invalidInput('Indica al menos un cambio.');
    const session = await openDraft(studio, nodeId);
    const slide = findSlide(session.version, session.remap.id(slideId));
    const saved = decodeSlide(
      (await studio.request(`mutation($i: SlideInput!) { saveSlide(input: $i) { ${SLIDE_FIELDS} } }`, { i: { id: slide.id, versionId: session.version.id, ...changes } })).saveSlide,
    );
    return { slide: slideSummary(saved), ...draftNotice(session) };
  },
});

const moveSlide = defineTool({
  name: 'move_slide',
  description: 'Mueve una diapositiva a otra posición (1 es la primera).',
  action: ACTIONS.documentsEdit,
  input: z.object({ nodeId: nodeIdInput, slideId: slideIdInput, position: z.number().int().min(1).describe('Posición nueva; 1 es la primera.') }),
  run: async ({ nodeId, slideId, position }, { studio }) => {
    const session = await openDraft(studio, nodeId);
    const moving = findSlide(session.version, session.remap.id(slideId));
    const others = session.version.slides.filter((slide) => slide.id !== moving.id).map((slide) => slide.id);
    const target = Math.min(position, others.length + 1) - 1;
    const order = [...others.slice(0, target), moving.id, ...others.slice(target)];
    const reordered = list(
      (await studio.request('mutation($v: ID!, $ids: [ID!]!) { reorderSlides(versionId: $v, slideIds: $ids) { id position title } }', { v: session.version.id, ids: order })).reorderSlides,
    ).map(record);
    return { order: reordered.map((slide) => ({ id: text(slide.id), position: num(slide.position), title: text(slide.title) })), ...draftNotice(session) };
  },
});

const duplicateSlide = defineTool({
  name: 'duplicate_slide',
  description: 'Duplica una diapositiva con todo su contenido; la copia queda justo después.',
  action: ACTIONS.documentsEdit,
  input: z.object({ nodeId: nodeIdInput, slideId: slideIdInput }),
  run: async ({ nodeId, slideId }, { studio }) => {
    const session = await openDraft(studio, nodeId);
    const slide = findSlide(session.version, session.remap.id(slideId));
    const copy = decodeSlide((await studio.request(`mutation($s: ID!) { duplicateSlide(slideId: $s) { ${SLIDE_FIELDS} } }`, { s: slide.id })).duplicateSlide);
    return { slide: slideSummary(copy), ...draftNotice(session) };
  },
});

const deleteSlide = defineTool({
  name: 'delete_slide',
  description: 'Borra una diapositiva con todo su contenido. Antes de llamarla, pide confirmación a la persona con la herramienta de interfaz confirm_change.',
  action: ACTIONS.documentsEdit,
  input: z.object({ nodeId: nodeIdInput, slideId: slideIdInput }),
  run: async ({ nodeId, slideId }, { studio }) => {
    const session = await openDraft(studio, nodeId);
    const slide = findSlide(session.version, session.remap.id(slideId));
    const result = record((await studio.request('mutation($s: ID!) { deleteSlide(slideId: $s) { id deleted } }', { s: slide.id })).deleteSlide);
    return { deleted: result.deleted === true, slideId: slide.id, ...draftNotice(session) };
  },
});

export const SLIDE_TOOLS: readonly StudioTool[] = [addSlides, updateSlide, moveSlide, duplicateSlide, deleteSlide];
