import { fileURLToPath } from 'node:url';

/** Absolute path of the Lumia Studio schema. */
export const STUDIO_SCHEMA_PATH: string = fileURLToPath(new URL('./schema.graphql', import.meta.url));
