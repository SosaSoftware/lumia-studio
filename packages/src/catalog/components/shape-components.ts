import { z } from 'zod';
import { defineComponent } from '../component-definition.ts';
import { themeColorSchema } from '../theme-tokens.ts';

export const shapeComponent = defineComponent({
  key: 'shape',
  name: 'Forma',
  group: 'shapes',
  usage: 'Forma decorativa o para agrupar visualmente: rectángulo, elipse, línea o flecha.',
  propsSchema: z.object({
    kind: z.enum(['rectangle', 'ellipse', 'line', 'arrow']).describe('Tipo de forma'),
    fill: themeColorSchema,
    stroke: themeColorSchema,
    strokeWidth: z.number().min(0).max(8).describe('Grosor del borde'),
  }),
  defaults: { kind: 'rectangle', fill: 'surface-alt', stroke: 'accent', strokeWidth: 1 },
  defaultSize: { w: 20, h: 20 },
  usesMedia: false,
  isQuestion: false,
});

export const arrowComponent = defineComponent({
  key: 'arrow',
  name: 'Flecha',
  group: 'shapes',
  usage: 'Flecha direccional para señalar o conectar visualmente elementos.',
  propsSchema: z.object({
    direction: z.enum(['right', 'left', 'up', 'down']).describe('Dirección de la flecha'),
    color: themeColorSchema,
    strokeWidth: z.number().min(1).max(8).describe('Grosor de la flecha'),
  }),
  defaults: { direction: 'right', color: 'accent', strokeWidth: 2 },
  defaultSize: { w: 20, h: 4 },
  usesMedia: false,
  isQuestion: false,
});

export const connectorComponent = defineComponent({
  key: 'connector',
  name: 'Conector',
  group: 'shapes',
  usage: 'Línea que conecta visualmente dos elementos de la diapositiva.',
  propsSchema: z.object({
    fromElementId: z.string().describe('Id del elemento origen'),
    toElementId: z.string().describe('Id del elemento destino'),
    style: z.enum(['straight', 'elbow']).describe('Estilo de la línea'),
    color: themeColorSchema,
  }),
  defaults: { fromElementId: '', toElementId: '', style: 'straight', color: 'muted' },
  defaultSize: { w: 20, h: 10 },
  usesMedia: false,
  isQuestion: false,
});

const diagramNodeSchema = z.object({
  id: z.string().trim().min(1).max(20).describe('Id único del nodo'),
  text: z.string().trim().min(1).max(120).describe('Texto del nodo'),
});

const diagramEdgeSchema = z.object({
  from: z.string().trim().min(1).max(20).describe('Id del nodo origen'),
  to: z.string().trim().min(1).max(20).describe('Id del nodo destino'),
});

export const diagramComponent = defineComponent({
  key: 'diagram',
  name: 'Diagrama',
  group: 'shapes',
  usage: 'Diagrama de flujo, ciclo o jerarquía con nodos y conexiones.',
  propsSchema: z
    .object({
      kind: z.enum(['flow', 'cycle', 'hierarchy']).describe('Tipo de diagrama'),
      nodes: z.array(diagramNodeSchema).min(2).max(8).describe('Nodos del diagrama'),
      edges: z.array(diagramEdgeSchema).describe('Conexiones entre nodos'),
    })
    .refine((props) => new Set(props.nodes.map((node) => node.id)).size === props.nodes.length, {
      message: 'Los ids de los nodos deben ser únicos.',
      path: ['nodes'],
    })
    .refine(
      (props) => {
        const nodeIds = new Set(props.nodes.map((node) => node.id));
        return props.edges.every((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
      },
      {
        message: 'Cada arista debe referenciar nodos existentes.',
        path: ['edges'],
      },
    ),
  defaults: {
    kind: 'flow',
    nodes: [
      { id: 'a', text: 'Inicio' },
      { id: 'b', text: 'Fin' },
    ],
    edges: [{ from: 'a', to: 'b' }],
  },
  defaultSize: { w: 60, h: 40 },
  usesMedia: false,
  isQuestion: false,
});
