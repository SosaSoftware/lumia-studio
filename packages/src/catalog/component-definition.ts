import type { z } from 'zod';
import type { Size } from './geometry.ts';

export type ComponentGroup = 'text' | 'media' | 'shapes' | 'interactive' | 'questions';

export const COMPONENT_GROUP_NAMES: Readonly<Record<ComponentGroup, string>> = {
  text: 'Texto',
  media: 'Multimedia',
  shapes: 'Formas y diagramas',
  interactive: 'Interactivos',
  questions: 'Preguntas',
};

/** One entry of the Studio component catalog: the single source for the API, Lumi and the web app. */
export interface ComponentDefinition<TSchema extends z.ZodType = z.ZodType> {
  readonly key: string;
  readonly name: string;
  readonly group: ComponentGroup;
  /** When to use the component; Lumi reads it to choose components. */
  readonly usage: string;
  readonly propsSchema: TSchema;
  readonly defaults: z.infer<TSchema>;
  readonly defaultSize: Size;
  /**
   * The height of the component is the height of its content: the editor sizes the frame to it, so the frame has no
   * empty space and grows with the content. Components that fill their frame leave it out; `defaultSize.h` is then
   * the height they start with and the person resizes them.
   */
  readonly fitsContent?: boolean;
  /** The props reference media assets: one `mediaId` (image, video, audio, illustration) or one per item (gallery). */
  readonly usesMedia: boolean;
  readonly isQuestion: boolean;
}

/** Keeps the inferred props type of each definition while checking the shape. */
export function defineComponent<TSchema extends z.ZodType>(definition: ComponentDefinition<TSchema>): ComponentDefinition<TSchema> {
  return definition;
}
