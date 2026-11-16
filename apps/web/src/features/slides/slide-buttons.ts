import { ADVANCING_BUTTON_ACTIONS, BUTTON_COMPONENT, START_BUTTON_ACTION } from '@lumia/packages/catalog';
import type { Slide, SlideElement } from '../../api/types.ts';

/** What a slide needs to tell which buttons it uses. */
export type ButtonSlide = Pick<Slide, 'unlock' | 'startMode' | 'startElementId' | 'unlockElementId' | 'elements'>;

/** The button `id` of the slide when it exists and its action is one of `actions`; null otherwise. */
export function slideButton(slide: Pick<Slide, 'elements'>, id: string | null, actions: readonly string[]): SlideElement | null {
  if (id === null) return null;
  const element = slide.elements.find((candidate) => candidate.id === id);
  if (element?.component !== BUTTON_COMPONENT) return null;
  const action = element.props.action;
  return typeof action === 'string' && actions.includes(action) ? element : null;
}

/** The start button the slide uses now: it waits for the time and starts with a button that starts it. */
export function activeStartButton(slide: ButtonSlide): SlideElement | null {
  return slide.unlock === 'after_time' && slide.startMode === 'button' ? slideButton(slide, slide.startElementId, [START_BUTTON_ACTION]) : null;
}

/** The custom button the slide uses now: a button that moves on instead of the lateral Next. */
export function activeCustomButton(slide: ButtonSlide): SlideElement | null {
  return slide.unlock === 'custom_button' ? slideButton(slide, slide.unlockElementId, ADVANCING_BUTTON_ACTIONS) : null;
}
