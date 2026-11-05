import type { FieldHandler } from '../runtime/field-pipeline.ts';
import { handler as documents } from './documents/index.ts';
import { handler as media } from './media/index.ts';
import { handler as narration } from './narration/index.ts';
import { handler as publish } from './publish/index.ts';
import { handler as tree } from './tree/index.ts';

export type { FieldHandler } from '../runtime/field-pipeline.ts';

/** Handler of each name used by `STUDIO_FIELDS`; in AWS each one is a Lambda function. */
export const HANDLERS: Readonly<Record<string, FieldHandler>> = { documents, media, narration, publish, tree };
