import type { ThemeColorKey } from './theme-tokens.ts';

export const SLIDE_TYPE_KEYS = ['cover', 'explanatory', 'video', 'whiteboard', 'quiz', 'closing'] as const;

export type SlideTypeKey = (typeof SLIDE_TYPE_KEYS)[number];

/**
 * How a slide moves on in the class: by itself when its time ends (`auto`), with a click (`click`), or once every
 * question on it is answered correctly or runs out of attempts (`on_complete`).
 */
export const ADVANCE_MODES = ['auto', 'click', 'on_complete'] as const;

export type AdvanceMode = (typeof ADVANCE_MODES)[number];

/** How the layout engine arranges elements on a slide type. */
export type SlideLayoutKind = 'centered' | 'content' | 'media' | 'questions';

export interface SlideTypeDefinition {
  readonly key: SlideTypeKey;
  readonly name: string;
  readonly usage: string;
  readonly layout: SlideLayoutKind;
  readonly defaultBackground: ThemeColorKey;
  readonly defaultDurationS: number;
  readonly defaultAdvance: AdvanceMode;
  /** Components added when a person creates an empty slide of this type. */
  readonly starterComponents: readonly string[];
}

export const SLIDE_TYPES: readonly SlideTypeDefinition[] = [
  { key: 'cover', name: 'Portada', usage: 'Primera diapositiva: título de la clase y una frase que presenta el tema.', layout: 'centered', defaultBackground: 'surface', defaultDurationS: 8, defaultAdvance: 'click', starterComponents: ['title', 'paragraph'] },
  { key: 'explanatory', name: 'Explicativa', usage: 'Explica un concepto con texto, listas, imágenes o destacados.', layout: 'content', defaultBackground: 'surface', defaultDurationS: 30, defaultAdvance: 'click', starterComponents: ['title', 'paragraph'] },
  { key: 'video', name: 'Video', usage: 'Muestra un video con un título y, opcionalmente, una nota breve.', layout: 'media', defaultBackground: 'surface', defaultDurationS: 60, defaultAdvance: 'click', starterComponents: ['title', 'video'] },
  { key: 'whiteboard', name: 'Pizarra animada', usage: 'Desarrolla un procedimiento paso a paso, como en una pizarra.', layout: 'content', defaultBackground: 'surface-alt', defaultDurationS: 45, defaultAdvance: 'click', starterComponents: ['title', 'bullet_list'] },
  { key: 'quiz', name: 'Quiz', usage: 'Preguntas para comprobar lo aprendido: opción múltiple o verdadero o falso.', layout: 'questions', defaultBackground: 'surface', defaultDurationS: 60, defaultAdvance: 'on_complete', starterComponents: ['title', 'multiple_choice'] },
  { key: 'closing', name: 'Cierre', usage: 'Última diapositiva: resumen de lo aprendido y un mensaje de cierre.', layout: 'centered', defaultBackground: 'surface', defaultDurationS: 10, defaultAdvance: 'click', starterComponents: ['title', 'bullet_list'] },
];

export function findSlideType(key: string): SlideTypeDefinition | undefined {
  return SLIDE_TYPES.find((type) => type.key === key);
}
