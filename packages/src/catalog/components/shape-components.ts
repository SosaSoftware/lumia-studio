import { z } from 'zod';
import { defineComponent } from '../component-definition.ts';
import { themeColorSchema } from '../theme-tokens.ts';
import { parseFlowchart, parseMindmap } from '../diagram-code.ts';
import { colorProp, flag, variantProp } from './shared.ts';

export const shapeComponent = defineComponent({
  key: 'shape',
  name: 'Forma',
  group: 'shapes',
  usage: 'Forma geométrica básica para decorar o agrupar: rectángulo, cuadrado, círculo, elipse, triángulo, rombo, pentágono, hexágono, octágono, estrella, corazón, cruz, paralelogramo o trapecio. Puede llevar un texto corto dentro.',
  propsSchema: z.object({
    kind: z
      .enum(['rectangle', 'rounded', 'square', 'ellipse', 'circle', 'triangle', 'right_triangle', 'diamond', 'parallelogram', 'trapezoid', 'pentagon', 'hexagon', 'octagon', 'star', 'heart', 'cross', 'line', 'arrow'])
      .describe('Tipo de forma. square y circle mantienen iguales sus lados; line y arrow se conservan por compatibilidad')
      .meta({ control: 'shape' }),
    fill: themeColorSchema,
    stroke: themeColorSchema,
    strokeWidth: z.number().min(0).max(8).describe('Grosor del borde'),
    variant: variantProp('soft'),
    text: z.string().trim().max(80).default('').describe('Texto corto dentro de la forma; vacío para no mostrarlo'),
    shadow: flag(false, 'Sombra bajo la forma'),
  }),
  defaults: { kind: 'rectangle', fill: 'surface-alt', stroke: 'accent', strokeWidth: 1, variant: 'soft', text: '', shadow: false },
  defaultSize: { w: 20, h: 20 },
  usesMedia: false,
  isQuestion: false,
});

const anchorSchema = z.enum(['auto', 'top', 'right', 'bottom', 'left']);

export const arrowComponent = defineComponent({
  key: 'arrow',
  name: 'Flecha',
  group: 'shapes',
  usage: 'Flecha para señalar o para unir dos componentes de la diapositiva. Con fromElementId y toElementId une dos elementos y los sigue si se mueven; sin ellos es una flecha libre con dirección.',
  propsSchema: z.object({
    direction: z.enum(['right', 'left', 'up', 'down']).describe('Dirección de la flecha libre; no se usa cuando une dos elementos'),
    color: themeColorSchema,
    strokeWidth: z.number().min(1).max(8).describe('Grosor de la flecha'),
    line: z.enum(['solid', 'dashed', 'dotted']).default('solid').describe('Trazo de la línea'),
    style: z.enum(['straight', 'curved', 'elbow']).default('straight').describe('Forma de la línea: straight (recta), curved (curva) o elbow (en codo, solo al unir dos elementos)'),
    doubleHead: flag(false, 'Punta en los dos extremos'),
    animated: flag(false, 'La flecha avanza en su dirección para llamar la atención'),
    fromElementId: z.string().default('').describe('Id del elemento donde empieza la flecha; vacío para una flecha libre. Debe ir junto con toElementId').meta({ ref: { slideElements: true } }),
    toElementId: z.string().default('').describe('Id del elemento donde termina la flecha; vacío para una flecha libre. Debe ir junto con fromElementId').meta({ ref: { slideElements: true } }),
    fromAnchor: anchorSchema.default('auto').describe('Lado del elemento de origen por el que sale: auto (el más cercano), top, right, bottom o left'),
    toAnchor: anchorSchema.default('auto').describe('Lado del elemento de destino por el que llega: auto (el más cercano), top, right, bottom o left'),
  }),
  defaults: {
    direction: 'right',
    color: 'accent',
    strokeWidth: 2,
    line: 'solid',
    style: 'straight',
    doubleHead: false,
    animated: false,
    fromElementId: '',
    toElementId: '',
    fromAnchor: 'auto',
    toAnchor: 'auto',
  },
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
    fromElementId: z.string().describe('Id del elemento origen').meta({ ref: { slideElements: true } }),
    toElementId: z.string().describe('Id del elemento destino').meta({ ref: { slideElements: true } }),
    style: z.enum(['straight', 'elbow', 'curved']).describe('Forma de la línea: straight (recta), elbow (en codo) o curved (curva)'),
    color: themeColorSchema,
    line: z.enum(['solid', 'dashed', 'dotted']).default('dashed').describe('Trazo de la línea'),
    strokeWidth: z.number().min(1).max(8).default(2.5).describe('Grosor de la línea'),
    arrowHead: flag(false, 'Punta de flecha en el destino'),
    animated: flag(false, 'El trazo fluye del origen al destino'),
  }),
  defaults: { fromElementId: '', toElementId: '', style: 'straight', color: 'muted', line: 'dashed', strokeWidth: 2.5, arrowHead: false, animated: false },
  defaultSize: { w: 20, h: 10 },
  usesMedia: false,
  isQuestion: false,
});

const FLOWCHART_HELP =
  'Diagrama en sintaxis Mermaid. La primera línea es "flowchart LR" (horizontal, de izquierda a derecha) o "flowchart TD" (vertical, de arriba abajo). Ejemplo: "flowchart LR" y, en líneas siguientes, "A[Inicio] --> B{¿Listo?}" y "B -->|Sí| C([Fin])". Nodos: A[rectángulo], A(redondeado), A([píldora]), A((círculo)), A{rombo}. Uniones: -->, ---, -.-> y ==>, con etiqueta -->|texto|. Hasta 12 nodos.';

const legacyNodeSchema = z.object({
  id: z.string().trim().min(1).max(20),
  text: z.string().trim().min(1).max(120),
});

const legacyEdgeSchema = z.object({
  from: z.string().trim().min(1).max(20),
  to: z.string().trim().min(1).max(20),
});

export const diagramComponent = defineComponent({
  key: 'diagram',
  name: 'Diagrama',
  group: 'shapes',
  usage: 'Diagrama de flujo, ciclo o jerarquía escrito en sintaxis Mermaid (flowchart): nodos con forma y uniones con flechas y etiquetas. kind elige la distribución: flow (por capas; la orientación la da la primera línea, flowchart LR o TD), cycle (en círculo) o hierarchy (por capas, siempre de arriba abajo).',
  propsSchema: z
    .object({
      kind: z.enum(['flow', 'cycle', 'hierarchy']).describe('Distribución: flow (por capas, horizontal o vertical según el texto), cycle (en círculo) o hierarchy (de arriba abajo)'),
      code: z.string().max(4000).default('').describe(FLOWCHART_HELP).meta({ editor: 'flowchart' }),
      nodes: z.array(legacyNodeSchema).max(8).optional().meta({ hidden: true }),
      edges: z.array(legacyEdgeSchema).optional().meta({ hidden: true }),
      color: colorProp('primary', 'Color de los nodos'),
      variant: variantProp('soft'),
      colorful: flag(false, 'Pintar cada nodo de un color distinto'),
      animated: flag(true, 'Los nodos aparecen en secuencia'),
    })
    .superRefine((props, context) => {
      if (props.code.trim() !== '') {
        const { model, issues } = parseFlowchart(props.code);
        const first = issues[0];
        if (first !== undefined) context.addIssue({ code: 'custom', path: ['code'], message: `Línea ${String(first.line)}: ${first.message}` });
        else if (model.nodes.length < 2) context.addIssue({ code: 'custom', path: ['code'], message: 'El diagrama necesita al menos dos nodos.' });
        return;
      }
      const nodes = props.nodes ?? [];
      if (nodes.length < 2) {
        context.addIssue({ code: 'custom', path: ['code'], message: 'Escribe el diagrama en sintaxis Mermaid, por ejemplo: A[Inicio] --> B[Fin].' });
        return;
      }
      const ids = new Set(nodes.map((node) => node.id));
      if (ids.size !== nodes.length) context.addIssue({ code: 'custom', path: ['nodes'], message: 'Los ids de los nodos deben ser únicos.' });
      if (!(props.edges ?? []).every((edge) => ids.has(edge.from) && ids.has(edge.to))) context.addIssue({ code: 'custom', path: ['edges'], message: 'Cada arista debe referenciar nodos existentes.' });
    }),
  defaults: {
    kind: 'flow',
    code: 'flowchart LR\n  A[Inicio] --> B{¿Entendiste?}\n  B -->|Sí| C([Siguiente tema])\n  B -->|No| D[Repasar] --> A',
    color: 'primary',
    variant: 'soft',
    colorful: false,
    animated: true,
  },
  defaultSize: { w: 64, h: 36 },
  usesMedia: false,
  isQuestion: false,
});

const MINDMAP_HELP =
  'Mapa mental en sintaxis Mermaid. La primera línea es "mindmap", la siguiente la idea central como root((Tema)) y las demás ramas sangradas por niveles (dos espacios por nivel). Un emoji al inicio del texto se muestra junto a la rama. Hasta 40 nodos y 4 niveles.';

const legacyBranchSchema = z.object({
  text: z.string().trim().min(1).max(60),
  emoji: z.string().trim().max(14).default(''),
  details: z.array(z.string().trim().min(1).max(60)).max(4).default([]),
});

export const mindmapComponent = defineComponent({
  key: 'mindmap',
  name: 'Mapa mental',
  group: 'shapes',
  usage: 'Mapa mental escrito en sintaxis Mermaid (mindmap): una idea central y ramas con sub-ideas, sangradas por niveles. Para organizar un tema.',
  propsSchema: z
    .object({
      code: z.string().max(4000).default('').describe(MINDMAP_HELP).meta({ editor: 'mindmap' }),
      center: z.string().trim().min(1).max(60).optional().meta({ hidden: true }),
      emoji: z.string().trim().max(14).optional().meta({ hidden: true }),
      branches: z.array(legacyBranchSchema).max(8).optional().meta({ hidden: true }),
      color: colorProp('primary', 'Color de la idea central'),
      colorful: z.boolean().describe('Pintar cada rama de un color distinto'),
      animated: z.boolean().describe('Las ramas aparecen en secuencia'),
    })
    .superRefine((props, context) => {
      if (props.code.trim() === '') {
        if (props.center === undefined || (props.branches ?? []).length < 2) context.addIssue({ code: 'custom', path: ['code'], message: 'Escribe el mapa en sintaxis Mermaid, por ejemplo: mindmap / root((Tema)) / Rama.' });
        return;
      }
      const { root, issues } = parseMindmap(props.code);
      const first = issues[0];
      if (first !== undefined) context.addIssue({ code: 'custom', path: ['code'], message: `Línea ${String(first.line)}: ${first.message}` });
      else if (root !== null && root.children.length < 1) context.addIssue({ code: 'custom', path: ['code'], message: 'El mapa necesita al menos una rama bajo la idea central.' });
    }),
  defaults: {
    code: 'mindmap\n  root((⚡ Energía))\n    ☀️ Solar\n      Paneles\n      Limpia\n    🌬️ Eólica\n      Turbinas\n    💧 Hidráulica\n      Represas\n    🛢️ Fósil\n      Petróleo\n      Carbón',
    color: 'primary',
    colorful: true,
    animated: true,
  },
  defaultSize: { w: 70, h: 40 },
  usesMedia: false,
  isQuestion: false,
});

const levelSchema = z.object({
  label: z.string().trim().min(1).max(60).describe('Nombre del nivel'),
  description: z.string().trim().max(120).describe('Descripción corta del nivel'),
});

export const pyramidComponent = defineComponent({
  key: 'pyramid',
  name: 'Pirámide',
  group: 'shapes',
  usage: 'Jerarquía de 2 a 6 niveles en forma de pirámide, de la cima a la base. Para prioridades o cadenas.',
  propsSchema: z.object({
    levels: z.array(levelSchema).min(2).max(6).describe('Niveles, de la cima a la base'),
    color: colorProp('orange'),
    colorful: z.boolean().describe('Pintar cada nivel de un color distinto'),
    inverted: z.boolean().describe('Invertir la pirámide: la cima queda abajo'),
    showDescriptions: z.boolean().describe('Mostrar las descripciones junto a la pirámide'),
    animated: z.boolean().describe('Los niveles aparecen en secuencia'),
  }),
  defaults: {
    levels: [
      { label: 'Carnívoros', description: 'Se alimentan de otros animales.' },
      { label: 'Herbívoros', description: 'Se alimentan de plantas.' },
      { label: 'Plantas', description: 'Producen su propio alimento.' },
    ],
    color: 'orange',
    colorful: true,
    inverted: false,
    showDescriptions: true,
    animated: true,
  },
  defaultSize: { w: 64, h: 34 },
  usesMedia: false,
  isQuestion: false,
});

const vennSetSchema = z.object({
  label: z.string().trim().min(1).max(40).describe('Nombre del conjunto'),
  items: z.array(z.string().trim().min(1).max(40)).max(5).describe('Elementos propios del conjunto'),
  color: themeColorSchema,
});

export const vennComponent = defineComponent({
  key: 'venn',
  name: 'Diagrama de Venn',
  group: 'shapes',
  usage: 'Dos o tres conjuntos que se cruzan, con sus elementos propios y los que comparten. Para comparar.',
  propsSchema: z.object({
    sets: z.array(vennSetSchema).min(2).max(3).describe('Conjuntos'),
    shared: z.array(z.string().trim().min(1).max(40)).max(5).describe('Elementos que todos los conjuntos comparten'),
    sharedLabel: z.string().trim().max(40).describe('Nombre de la intersección; vacío para no mostrarlo'),
    animated: z.boolean().describe('Los conjuntos se acercan al aparecer'),
  }),
  defaults: {
    sets: [
      { label: 'Aves', items: ['Plumas', 'Ponen huevos'], color: 'primary' },
      { label: 'Mamíferos', items: ['Pelo', 'Toman leche'], color: 'pink' },
    ],
    shared: ['Vertebrados', 'Respiran aire'],
    sharedLabel: 'Ambos',
    animated: true,
  },
  defaultSize: { w: 64, h: 36 },
  usesMedia: false,
  isQuestion: false,
});

const stageSchema = z.object({
  label: z.string().trim().min(1).max(60).describe('Nombre de la etapa'),
  value: z.string().trim().max(20).describe('Cifra de la etapa, por ejemplo 1 000 o 40 %; vacío para no mostrarla'),
});

export const funnelComponent = defineComponent({
  key: 'funnel',
  name: 'Embudo',
  group: 'shapes',
  usage: 'Etapas que se van estrechando, de la más amplia a la más pequeña. De 2 a 6 etapas.',
  propsSchema: z.object({
    stages: z.array(stageSchema).min(2).max(6).describe('Etapas, de la más amplia a la más estrecha'),
    color: colorProp('purple'),
    colorful: z.boolean().describe('Pintar cada etapa de un color distinto'),
    showValues: z.boolean().describe('Mostrar la cifra de cada etapa'),
    animated: z.boolean().describe('Las etapas aparecen en secuencia'),
  }),
  defaults: {
    stages: [
      { label: 'Observaciones', value: '100' },
      { label: 'Hipótesis', value: '40' },
      { label: 'Experimentos', value: '12' },
      { label: 'Conclusión', value: '1' },
    ],
    color: 'purple',
    colorful: false,
    showValues: true,
    animated: true,
  },
  defaultSize: { w: 50, h: 34 },
  usesMedia: false,
  isQuestion: false,
});
