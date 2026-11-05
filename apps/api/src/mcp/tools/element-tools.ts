import { z } from 'zod';
import { componentCatalog } from '@lumia/packages/catalog';
import { ACTIONS } from '../../auth/index.ts';
import { ENTRANCES } from '../../domain/enums.ts';
import { ELEMENT_FIELDS, decodeElement, elementView } from '../class-data.ts';
import { record } from '../decode.ts';
import { draftNotice, findElement, findSlide, openDraft } from '../draft.ts';
import type { StudioTool } from '../tool-definition.ts';
import { defineTool } from '../tool-definition.ts';
import { ToolError } from '../tool-error.ts';
import { elementIdInput, geometryInput, nodeIdInput, propsInput, secondsInput, slideIdInput } from './inputs.ts';

const SAVE_ELEMENT = `mutation($i: ElementInput!) { saveElement(input: $i) { ${ELEMENT_FIELDS} } }`;

const elementFields = {
  name: z.string().trim().min(1).optional().describe('Nombre en la línea de tiempo.'),
  ...geometryInput,
  appearsAtS: secondsInput.optional().describe('Segundo en que aparece.'),
  entrance: z.enum(ENTRANCES).optional().describe('Animación de entrada.'),
};

/** Props checked against the catalog; `complete` props are taken as they are, partial ones get the defaults. */
function validProps(component: string, props: Record<string, unknown>, complete: boolean): Record<string, unknown> {
  const result = complete ? componentCatalog.validateProps(component, props) : componentCatalog.withDefaults(component, props);
  if (!result.ok) throw ToolError.invalidInput(`${component}: ${result.errors.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`);
  return result.props;
}

const addElement = defineTool({
  name: 'add_element',
  description:
    'Agrega un componente a una diapositiva. Lo que falte de props toma los valores por defecto del catálogo. Sin posición queda centrado; revisa el espacio libre con get_slide.',
  action: ACTIONS.documentsEdit,
  input: z.object({
    nodeId: nodeIdInput,
    slideId: slideIdInput,
    component: z.string().min(1).describe('Llave del componente (list_components).'),
    ...elementFields,
    props: propsInput.optional(),
  }),
  run: async ({ nodeId, slideId, component, props, ...fields }, { studio }) => {
    if (componentCatalog.get(component) === undefined) throw ToolError.invalidInput(`El componente "${component}" no existe en el catálogo; usa list_components.`);
    const complete = validProps(component, props ?? {}, false);
    const session = await openDraft(studio, nodeId);
    const slide = findSlide(session.version, session.remap.id(slideId));
    const data = await studio.request(SAVE_ELEMENT, { i: { slideId: slide.id, component, ...fields, props: JSON.stringify(complete) } });
    return { element: elementView(decodeElement(data.saveElement)), slideId: slide.id, ...draftNotice(session) };
  },
});

const updateElement = defineTool({
  name: 'update_element',
  description:
    'Cambia un componente: props, nombre, posición, tamaño, entrada o el momento en que aparece. En props manda solo las llaves que cambian; se combinan con las actuales y una lista se reemplaza completa.',
  action: ACTIONS.documentsEdit,
  input: z.object({ nodeId: nodeIdInput, elementId: elementIdInput, ...elementFields, props: propsInput.optional() }),
  run: async ({ nodeId, elementId, props, ...fields }, { studio }) => {
    if (props === undefined && Object.keys(fields).length === 0) throw ToolError.invalidInput('Indica al menos un cambio.');
    const session = await openDraft(studio, nodeId);
    const { slide, item } = findElement(session.version, session.remap.id(elementId));
    const merged = validProps(item.component, { ...item.props, ...(props ?? {}) }, true);
    const data = await studio.request(SAVE_ELEMENT, { i: { id: item.id, slideId: slide.id, component: item.component, ...fields, props: JSON.stringify(merged) } });
    return { element: elementView(decodeElement(data.saveElement)), slideId: slide.id, ...draftNotice(session) };
  },
});

const deleteElement = defineTool({
  name: 'delete_element',
  description: 'Borra un componente de su diapositiva. Antes de llamarla, pide confirmación a la persona con la herramienta de interfaz confirm_change.',
  action: ACTIONS.documentsEdit,
  input: z.object({ nodeId: nodeIdInput, elementId: elementIdInput }),
  run: async ({ nodeId, elementId }, { studio }) => {
    const session = await openDraft(studio, nodeId);
    const { item } = findElement(session.version, session.remap.id(elementId));
    const result = record((await studio.request('mutation($e: ID!) { deleteElement(elementId: $e) { id deleted } }', { e: item.id })).deleteElement);
    return { deleted: result.deleted === true, elementId: item.id, ...draftNotice(session) };
  },
});

export const ELEMENT_TOOLS: readonly StudioTool[] = [addElement, updateElement, deleteElement];
