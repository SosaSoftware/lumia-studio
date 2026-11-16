import { z } from 'zod';
import { defineComponent } from '../component-definition.ts';
import { themeColorSchema } from '../theme-tokens.ts';
import { colorProp, emojiProp, variantProp } from './shared.ts';

const dataPointSchema = z.object({
  label: z.string().trim().min(1).max(40).describe('Etiqueta del dato'),
  value: z.number().min(0).max(1_000_000).describe('Valor del dato'),
  color: themeColorSchema,
});

export const barChartComponent = defineComponent({
  key: 'bar_chart',
  name: 'Gráfico de barras',
  group: 'data',
  usage: 'Compara de 2 a 10 cantidades con barras. Cada barra tiene etiqueta, valor y color.',
  propsSchema: z.object({
    title: z.string().trim().max(80).describe('Título del gráfico; vacío para ocultarlo'),
    bars: z.array(dataPointSchema).min(2).max(10).describe('Barras del gráfico'),
    orientation: z.enum(['vertical', 'horizontal']).describe('Dirección de las barras'),
    unit: z.string().trim().max(12).describe('Unidad que acompaña a los valores, por ejemplo km o %'),
    showValues: z.boolean().describe('Mostrar el valor de cada barra'),
    showGrid: z.boolean().describe('Mostrar las líneas guía'),
    animated: z.boolean().describe('Las barras crecen al aparecer'),
  }),
  defaults: {
    title: 'Lunas por planeta',
    bars: [
      { label: 'Tierra', value: 1, color: 'primary' },
      { label: 'Marte', value: 2, color: 'danger' },
      { label: 'Urano', value: 28, color: 'accent' },
      { label: 'Neptuno', value: 16, color: 'purple' },
    ],
    orientation: 'vertical',
    unit: '',
    showValues: true,
    showGrid: true,
    animated: true,
  },
  defaultSize: { w: 50, h: 32 },
  usesMedia: false,
  isQuestion: false,
});

export const donutChartComponent = defineComponent({
  key: 'donut_chart',
  name: 'Gráfico de dona',
  group: 'data',
  usage: 'Muestra cómo se reparte un total en 2 a 8 partes, como dona o pastel, con leyenda.',
  propsSchema: z.object({
    title: z.string().trim().max(80).describe('Título del gráfico; vacío para ocultarlo'),
    segments: z.array(dataPointSchema).min(2).max(8).describe('Partes del total'),
    kind: z.enum(['donut', 'pie']).describe('donut (dona con centro) o pie (pastel)'),
    centerValue: z.string().trim().max(12).describe('Texto grande del centro de la dona; vacío para mostrar el total'),
    centerLabel: z.string().trim().max(40).describe('Texto pequeño del centro de la dona'),
    showLegend: z.boolean().describe('Mostrar la leyenda'),
    showPercent: z.boolean().describe('Mostrar el porcentaje de cada parte en la leyenda'),
    animated: z.boolean().describe('Las partes se dibujan al aparecer'),
  }),
  defaults: {
    title: '',
    segments: [
      { label: 'Agua', value: 71, color: 'primary' },
      { label: 'Tierra', value: 29, color: 'success' },
    ],
    kind: 'donut',
    centerValue: '71 %',
    centerLabel: 'del planeta es agua',
    showLegend: true,
    showPercent: true,
    animated: true,
  },
  defaultSize: { w: 44, h: 28 },
  usesMedia: false,
  isQuestion: false,
});

export const counterComponent = defineComponent({
  key: 'counter',
  name: 'Contador',
  group: 'data',
  usage: 'Número grande que cuenta hasta su valor al aparecer, con etiqueta. Para destacar una cifra.',
  propsSchema: z.object({
    value: z.number().min(-1_000_000_000).max(1_000_000_000).describe('Valor final'),
    from: z.number().min(-1_000_000_000).max(1_000_000_000).describe('Valor desde el que empieza a contar'),
    decimals: z.number().int().min(0).max(3).describe('Cantidad de decimales'),
    prefix: z.string().trim().max(6).describe('Texto antes del número, por ejemplo $'),
    suffix: z.string().trim().max(10).describe('Texto después del número, por ejemplo % o km'),
    label: z.string().trim().max(80).describe('Descripción de la cifra'),
    emoji: emojiProp('', 'Emoji sobre la cifra; vacío para no mostrarlo'),
    durationS: z.number().min(0.5).max(10).describe('Segundos que tarda en contar'),
    color: colorProp('primary', 'Color de la cifra'),
    gradient: z.boolean().describe('Pintar la cifra con degradado'),
  }),
  defaults: { value: 8, from: 0, decimals: 0, prefix: '', suffix: '', label: 'Planetas en el sistema solar', emoji: '🪐', durationS: 2, color: 'primary', gradient: true },
  defaultSize: { w: 26, h: 18 },
  usesMedia: false,
  isQuestion: false,
});

export const progressRingComponent = defineComponent({
  key: 'progress_ring',
  name: 'Anillo de progreso',
  group: 'data',
  usage: 'Anillo que se llena hasta un porcentaje, con el valor al centro. Para avance o proporciones.',
  propsSchema: z.object({
    value: z.number().min(0).max(1_000_000).describe('Valor actual'),
    max: z.number().min(1).max(1_000_000).describe('Valor máximo'),
    label: z.string().trim().max(60).describe('Etiqueta bajo el valor'),
    display: z.enum(['percent', 'value', 'fraction']).describe('Qué se muestra al centro: percent (porcentaje), value (valor) o fraction (valor/máximo)'),
    color: colorProp('success'),
    thickness: z.enum(['thin', 'medium', 'thick']).describe('Grosor del anillo'),
    animated: z.boolean().describe('El anillo se llena al aparecer'),
  }),
  defaults: { value: 75, max: 100, label: 'Completado', display: 'percent', color: 'success', thickness: 'medium', animated: true },
  defaultSize: { w: 18, h: 24 },
  usesMedia: false,
  isQuestion: false,
});

export const progressBarComponent = defineComponent({
  key: 'progress_bar',
  name: 'Barra de progreso',
  group: 'data',
  usage: 'Barra horizontal que se llena hasta un valor, con etiqueta y porcentaje.',
  propsSchema: z.object({
    value: z.number().min(0).max(1_000_000).describe('Valor actual'),
    max: z.number().min(1).max(1_000_000).describe('Valor máximo'),
    label: z.string().trim().max(80).describe('Etiqueta de la barra'),
    showValue: z.boolean().describe('Mostrar el porcentaje'),
    color: colorProp('primary'),
    variant: variantProp('gradient'),
    striped: z.boolean().describe('Rayas animadas sobre la barra'),
    size: z.enum(['sm', 'md', 'lg']).describe('Grosor de la barra'),
    animated: z.boolean().describe('La barra se llena al aparecer'),
  }),
  defaults: { value: 65, max: 100, label: 'Progreso de la clase', showValue: true, color: 'primary', variant: 'gradient', striped: false, size: 'md', animated: true },
  defaultSize: { w: 50, h: 7 },
  fitsContent: true,
  usesMedia: false,
  isQuestion: false,
});

export const statCardComponent = defineComponent({
  key: 'stat_card',
  name: 'Tarjeta de dato',
  group: 'data',
  usage: 'Tarjeta con una cifra grande, emoji, descripción y tendencia opcional. Para datos clave.',
  propsSchema: z.object({
    value: z.string().trim().min(1).max(16).describe('Cifra, por ejemplo 8, 3,5 km o 40 %'),
    label: z.string().trim().min(1).max(80).describe('Qué representa la cifra'),
    emoji: emojiProp('🪐'),
    trend: z.enum(['none', 'up', 'down', 'neutral']).describe('Tendencia: none (sin tendencia), up (sube), down (baja) o neutral'),
    trendText: z.string().trim().max(24).describe('Texto de la tendencia, por ejemplo +2 este mes'),
    color: colorProp('primary'),
    variant: variantProp('gradient'),
  }),
  defaults: { value: '8', label: 'Planetas en el sistema solar', emoji: '🪐', trend: 'up', trendText: '+1 desde 2006', color: 'primary', variant: 'gradient' },
  defaultSize: { w: 36, h: 12 },
  usesMedia: false,
  isQuestion: false,
});
