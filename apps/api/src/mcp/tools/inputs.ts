import { z } from 'zod';
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '@lumia/packages/catalog';

/** Inputs shared by the tools. Studio validates everything again; these give the model clear early errors. */

export const nodeIdInput = z
  .string()
  .min(1)
  .describe('Id de la clase (nodo del árbol). Studio lo manda en el contexto como record.nodeId; también sale de list_tree.');

export const slideIdInput = z.string().min(1).describe('Id de la diapositiva (get_class).');

export const elementIdInput = z.string().min(1).describe('Id del componente (get_slide).');

export const propsInput = z
  .record(z.string(), z.unknown())
  .describe('Props del componente como objeto JSON. Su esquema y sus valores por defecto salen de list_components con keys.');

export const geometryInput = {
  x: z.number().min(0).max(SLIDE_WIDTH).optional().describe(`Borde izquierdo. La diapositiva mide ${String(SLIDE_WIDTH)} de ancho.`),
  y: z.number().min(0).max(SLIDE_HEIGHT).optional().describe(`Borde superior. La diapositiva mide ${String(SLIDE_HEIGHT)} de alto.`),
  w: z.number().positive().max(SLIDE_WIDTH).optional().describe('Ancho, en las mismas unidades.'),
  h: z.number().positive().max(SLIDE_HEIGHT).optional().describe('Alto, en las mismas unidades.'),
  z: z.number().int().min(0).optional().describe('Orden de apilado: mayor queda encima.'),
};

export const secondsInput = z.number().min(0);
