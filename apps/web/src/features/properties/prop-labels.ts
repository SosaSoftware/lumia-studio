import { CONTENT_ICON_LABELS } from '../slide-components/content-icons.ts';
import { COLOR_LABELS } from '../slides/slide-style.ts';

/** Field names shown in Properties; the schema descriptions are written for Lumi, not for people. */
const FIELD_LABELS: Readonly<Record<string, string>> = {
  text: 'Texto',
  level: 'Nivel',
  align: 'Alineación',
  size: 'Tamaño de letra',
  items: 'Elementos',
  ordered: 'Numerada',
  title: 'Título',
  tone: 'Tipo',
  columns: 'Columnas',
  rows: 'Filas',
  headerRow: 'Encabezado',
  mediaId: 'Medio',
  alt: 'Texto alternativo',
  prompt: 'Descripción del medio que falta',
  caption: 'Pie',
  fit: 'Ajuste',
  startAtS: 'Empieza en (s)',
  autoplay: 'Reproducir al aparecer',
  showControls: 'Controles',
  name: 'Ícono',
  color: 'Color',
  label: 'Etiqueta',
  style: 'Estilo',
  kind: 'Tipo',
  fill: 'Relleno',
  stroke: 'Borde',
  strokeWidth: 'Grosor',
  direction: 'Dirección',
  fromElementId: 'Desde',
  toElementId: 'Hasta',
  nodes: 'Nodos',
  edges: 'Conexiones',
  from: 'Desde',
  to: 'Hasta',
  front: 'Frente',
  back: 'Reverso',
  action: 'Acción',
  target: 'Destino',
  content: 'Contenido',
  tabs: 'Pestañas',
  sections: 'Secciones',
  events: 'Eventos',
  description: 'Descripción',
  seconds: 'Duración (s)',
  autoStart: 'Iniciar solo',
  question: 'Pregunta',
  options: 'Opciones',
  correctOptionId: 'Respuesta correcta',
  feedbackCorrect: 'Retroalimentación al acertar',
  feedbackIncorrect: 'Retroalimentación al fallar',
  attempts: 'Intentos',
  statement: 'Afirmación',
  answer: 'Respuesta correcta',
  caseSensitive: 'Distinguir mayúsculas',
  targets: 'Destinos',
  correctItemId: 'Elemento correcto',
  pairs: 'Pares',
  left: 'Izquierda',
  right: 'Derecha',
  id: 'Id',
};

const VALUE_LABELS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  align: { left: 'Izquierda', center: 'Centro', right: 'Derecha' },
  level: { h1: 'Principal', h2: 'Secundario' },
  size: { sm: 'Pequeño', md: 'Mediano', lg: 'Grande' },
  tone: { key: 'Idea clave', tip: 'Consejo', info: 'Dato', warning: 'Atención' },
  fit: { contain: 'Completa', cover: 'Rellenar' },
  direction: { right: 'Derecha', left: 'Izquierda', up: 'Arriba', down: 'Abajo' },
  action: { next_slide: 'Siguiente', go_to_slide: 'Ir a diapositiva', open_url: 'Abrir enlace' },
  'illustration.style': { flat: 'Plana', line: 'Líneas', photo: 'Foto' },
  'connector.style': { straight: 'Recta', elbow: 'En codo' },
  'shape.kind': { rectangle: 'Rectángulo', ellipse: 'Elipse', line: 'Línea', arrow: 'Flecha' },
  'diagram.kind': { flow: 'Flujo', cycle: 'Ciclo', hierarchy: 'Jerarquía' },
};

export function fieldLabel(key: string, fallback: string): string {
  return FIELD_LABELS[key] ?? fallback;
}

/** Label of an enum value; colors and icons use their own names. */
export function valueLabel(component: string, key: string, value: string): string {
  const scoped = VALUE_LABELS[`${component}.${key}`]?.[value] ?? VALUE_LABELS[key]?.[value];
  if (scoped !== undefined) return scoped;
  const named = [...Object.entries(COLOR_LABELS), ...Object.entries(CONTENT_ICON_LABELS)].find(([name]) => name === value);
  return named?.[1] ?? value;
}

/** Yes and no labels of a boolean prop. */
export function booleanLabels(component: string, key: string): [string, string] {
  if (component === 'true_false' && key === 'answer') return ['Verdadero', 'Falso'];
  if (key === 'headerRow') return ['Primera fila', 'Sin encabezado'];
  if (key === 'ordered') return ['Numerada', 'Viñetas'];
  if (key === 'showControls') return ['Visibles', 'Ocultos'];
  return ['Sí', 'No'];
}
