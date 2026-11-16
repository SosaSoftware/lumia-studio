import { z } from 'zod';
import { defineComponent } from '../component-definition.ts';
import { ICON_NAMES } from '../icons.ts';
import { themeColorSchema } from '../theme-tokens.ts';
import { colorProp, emojiProp, flag, variantProp } from './shared.ts';

export const imageComponent = defineComponent({
  key: 'image',
  name: 'Imagen',
  group: 'media',
  usage: 'Imagen que apoya la explicación. Sin medio subido, describe en prompt la imagen que la persona debe agregar.',
  propsSchema: z.object({
    mediaId: z.uuid().nullable().describe('Id del medio subido, o null si falta subirlo'),
    alt: z.string().trim().min(1).max(200).describe('Texto alternativo'),
    prompt: z.string().trim().max(300).describe('Descripción de la imagen deseada cuando falta el medio'),
    caption: z.string().trim().max(160).describe('Pie de imagen opcional'),
    fit: z.enum(['cover', 'contain']).describe('Cómo se ajusta la imagen a su marco'),
    frame: z.enum(['rounded', 'plain', 'circle', 'polaroid']).default('rounded').describe('Marco: rounded (redondeado), plain (sin esquinas), circle (círculo) o polaroid'),
    captionStyle: z.enum(['pill', 'overlay', 'below']).default('pill').describe('Dónde va el pie: pill (etiqueta), overlay (franja sobre la imagen) o below (debajo)'),
    shadow: flag(false, 'Sombra bajo la imagen'),
    hoverZoom: flag(false, 'La imagen se acerca cuando el estudiante pasa el cursor'),
  }),
  defaults: { mediaId: null, alt: 'Imagen', prompt: '', caption: '', fit: 'contain', frame: 'rounded', captionStyle: 'pill', shadow: false, hoverZoom: false },
  defaultSize: { w: 40, h: 30 },
  usesMedia: true,
  isQuestion: false,
});

export const videoComponent = defineComponent({
  key: 'video',
  name: 'Video',
  group: 'media',
  usage: 'Video corto. Sin medio subido, describe en prompt el video que la persona debe agregar.',
  propsSchema: z.object({
    mediaId: z.uuid().nullable().describe('Id del medio subido, o null si falta subirlo').meta({ accept: 'video/*' }),
    title: z.string().trim().min(1).max(120).describe('Título del video'),
    prompt: z.string().trim().max(300).describe('Descripción del video deseado cuando falta el medio'),
    startAtS: z.number().min(0).describe('Segundo en el que empieza'),
    autoplay: z.boolean().describe('Se reproduce al aparecer'),
    loop: flag(false, 'Repetir al terminar'),
    showTitle: flag(false, 'Mostrar el título sobre el video'),
    color: colorProp('primary', 'Color del botón de reproducir'),
  }),
  defaults: { mediaId: null, title: 'Video', prompt: '', startAtS: 0, autoplay: false, loop: false, showTitle: false, color: 'primary' },
  defaultSize: { w: 64, h: 36 },
  usesMedia: true,
  isQuestion: false,
});

export const audioComponent = defineComponent({
  key: 'audio',
  name: 'Audio',
  group: 'media',
  usage: 'Clip de audio. Sin medio subido, describe en prompt el audio que la persona debe agregar.',
  propsSchema: z.object({
    mediaId: z.uuid().nullable().describe('Id del medio subido, o null si falta subirlo').meta({ accept: 'audio/*' }),
    title: z.string().trim().min(1).max(120).describe('Título del audio'),
    prompt: z.string().trim().max(300).describe('Descripción del audio deseado cuando falta el medio'),
    showControls: z.boolean().describe('Mostrar controles de reproducción'),
    color: colorProp('primary', 'Color del botón y de las ondas'),
    variant: variantProp('gradient'),
    emoji: emojiProp('', 'Emoji junto al título; vacío para no mostrarlo'),
  }),
  defaults: { mediaId: null, title: 'Audio', prompt: '', showControls: true, color: 'primary', variant: 'gradient', emoji: '' },
  defaultSize: { w: 50, h: 8 },
  usesMedia: true,
  isQuestion: false,
});

export const iconComponent = defineComponent({
  key: 'icon',
  name: 'Ícono',
  group: 'media',
  usage: 'Ícono decorativo del catálogo para acompañar texto o resaltar ideas.',
  propsSchema: z.object({
    name: z.enum(ICON_NAMES).describe('Nombre del ícono').meta({ control: 'icon' }),
    color: themeColorSchema,
    label: z.string().trim().max(80).describe('Etiqueta accesible del ícono'),
    background: z.enum(['none', 'soft', 'solid', 'gradient']).default('soft').describe('Fondo del ícono: none (sin fondo), soft (suave), solid (sólido) o gradient (degradado)'),
    shape: z.enum(['circle', 'rounded']).default('circle').describe('Forma del fondo'),
  }),
  defaults: { name: 'idea', color: 'accent', label: '', background: 'soft', shape: 'circle' },
  defaultSize: { w: 8, h: 8 },
  usesMedia: false,
  isQuestion: false,
});

export const illustrationComponent = defineComponent({
  key: 'illustration',
  name: 'Ilustración',
  group: 'media',
  usage: 'Ilustración generada o subida. Describe en prompt el estilo y contenido deseado.',
  propsSchema: z.object({
    mediaId: z.uuid().nullable().describe('Id del medio subido, o null si falta subirlo'),
    alt: z.string().trim().min(1).max(200).describe('Texto alternativo'),
    prompt: z.string().trim().max(300).describe('Descripción de la ilustración deseada'),
    style: z.enum(['flat', 'line', 'photo']).describe('Estilo visual de la ilustración'),
  }),
  defaults: { mediaId: null, alt: 'Ilustración', prompt: '', style: 'flat' },
  defaultSize: { w: 40, h: 30 },
  usesMedia: true,
  isQuestion: false,
});

export const animationComponent = defineComponent({
  key: 'animation',
  name: 'Animación',
  group: 'media',
  usage: 'GIF o imagen con movimiento continuo (flotar, latir, girar, rebotar) para dar vida a la diapositiva.',
  propsSchema: z.object({
    mediaId: z.uuid().nullable().describe('Id del GIF o imagen subida, o null si falta subirla'),
    alt: z.string().trim().min(1).max(200).describe('Texto alternativo'),
    prompt: z.string().trim().max(300).describe('Descripción de la animación deseada cuando falta el medio'),
    emoji: emojiProp('🚀', 'Emoji que se anima mientras no hay medio; vacío para mostrar el marcador'),
    effect: z.enum(['none', 'float', 'pulse', 'bounce', 'wiggle', 'spin']).describe('Movimiento: none, float (flotar), pulse (latir), bounce (rebotar), wiggle (balancear) o spin (girar)'),
    speed: z.enum(['slow', 'normal', 'fast']).describe('Velocidad del movimiento'),
    fit: z.enum(['cover', 'contain']).describe('Cómo se ajusta la imagen a su marco'),
    frame: z.enum(['none', 'rounded', 'circle']).describe('Marco de la imagen'),
  }),
  defaults: { mediaId: null, alt: 'Animación', prompt: '', emoji: '🚀', effect: 'float', speed: 'normal', fit: 'contain', frame: 'none' },
  defaultSize: { w: 18, h: 18 },
  usesMedia: true,
  isQuestion: false,
});

const comparedImageSchema = z.object({
  mediaId: z.uuid().nullable().describe('Id del medio subido, o null si falta subirlo'),
  label: z.string().trim().min(1).max(40).describe('Etiqueta de la imagen, por ejemplo Antes'),
  alt: z.string().trim().min(1).max(200).describe('Texto alternativo'),
});

export const beforeAfterComponent = defineComponent({
  key: 'before_after',
  name: 'Antes y después',
  group: 'media',
  usage: 'Dos imágenes superpuestas con un deslizador que el estudiante arrastra para compararlas.',
  propsSchema: z.object({
    images: z.array(comparedImageSchema).min(2).max(2).describe('Las dos imágenes: primero la de antes, luego la de después'),
    orientation: z.enum(['horizontal', 'vertical']).describe('Dirección en la que se mueve el deslizador'),
    start: z.number().min(0).max(100).describe('Posición inicial del deslizador, en porcentaje'),
    color: colorProp('primary', 'Color del deslizador'),
    showLabels: z.boolean().describe('Mostrar las etiquetas de cada imagen'),
  }),
  defaults: {
    images: [
      { mediaId: null, label: 'Antes', alt: 'Imagen de antes' },
      { mediaId: null, label: 'Después', alt: 'Imagen de después' },
    ],
    orientation: 'horizontal',
    start: 50,
    color: 'primary',
    showLabels: true,
  },
  defaultSize: { w: 50, h: 28 },
  usesMedia: true,
  isQuestion: false,
});

const galleryItemSchema = z.object({
  mediaId: z.uuid().nullable().describe('Id del medio subido, o null si falta subirlo'),
  alt: z.string().trim().min(1).max(200).describe('Texto alternativo'),
  caption: z.string().trim().max(160).describe('Pie de imagen opcional'),
});

export const galleryComponent = defineComponent({
  key: 'gallery',
  name: 'Galería',
  group: 'media',
  usage: 'Galería de 2 a 8 imágenes: una a la vez con navegación, en mosaico o en cuadrícula.',
  propsSchema: z.object({
    items: z.array(galleryItemSchema).min(2).max(8).describe('Elementos de la galería'),
    layout: z.enum(['slider', 'masonry', 'grid']).default('slider').describe('slider (una imagen con flechas), masonry (mosaico) o grid (cuadrícula)'),
    showCaptions: flag(true, 'Mostrar los pies de imagen'),
    color: colorProp('primary', 'Color de los indicadores'),
  }),
  defaults: {
    items: [
      { mediaId: null, alt: 'Imagen 1', caption: '' },
      { mediaId: null, alt: 'Imagen 2', caption: '' },
    ],
    layout: 'slider',
    showCaptions: true,
    color: 'primary',
  },
  defaultSize: { w: 80, h: 35 },
  usesMedia: true,
  isQuestion: false,
});

const carouselItemSchema = z.object({
  mediaId: z.uuid().nullable().describe('Imagen de la tarjeta, o null para usar el emoji'),
  emoji: emojiProp('⭐', 'Emoji de la tarjeta cuando no hay imagen'),
  title: z.string().trim().min(1).max(80).describe('Título de la tarjeta'),
  text: z.string().trim().max(300).describe('Texto de la tarjeta'),
});

export const carouselComponent = defineComponent({
  key: 'carousel',
  name: 'Carrusel',
  group: 'media',
  usage: 'Tarjetas con imagen o emoji, título y texto que el estudiante recorre una a una. De 2 a 8 tarjetas.',
  propsSchema: z.object({
    items: z.array(carouselItemSchema).min(2).max(8).describe('Tarjetas del carrusel'),
    autoPlay: z.boolean().describe('Avanzar solo'),
    intervalS: z.number().min(2).max(20).describe('Segundos entre tarjetas cuando avanza solo'),
    color: colorProp('purple'),
    variant: variantProp('soft'),
  }),
  defaults: {
    items: [
      { mediaId: null, emoji: '🌱', title: 'Semilla', text: 'Todo comienza con una semilla en la tierra.' },
      { mediaId: null, emoji: '🌿', title: 'Brote', text: 'Con agua y luz, aparece el primer brote.' },
      { mediaId: null, emoji: '🌳', title: 'Árbol', text: 'Con el tiempo se convierte en un árbol.' },
    ],
    autoPlay: false,
    intervalS: 4,
    color: 'purple',
    variant: 'soft',
  },
  defaultSize: { w: 44, h: 30 },
  usesMedia: true,
  isQuestion: false,
});
