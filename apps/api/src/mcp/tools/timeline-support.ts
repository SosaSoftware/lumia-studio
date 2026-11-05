import type { DraftSession } from '../draft.ts';
import { findSlide } from '../draft.ts';
import { ToolError } from '../tool-error.ts';

/** Slide of a new timeline item: required when the tool creates one instead of changing an existing one. */
export function slideFor(session: DraftSession, slideId: string | undefined, what: string): string {
  if (slideId === undefined) throw ToolError.invalidInput(`slideId: indica la diapositiva para crear ${what}.`);
  return findSlide(session.version, session.remap.id(slideId)).id;
}
