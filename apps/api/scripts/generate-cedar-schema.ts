import { writeFileSync } from 'node:fs';
import { buildCedarSchema, CEDAR_SCHEMA_URL } from '../src/authorization/index.ts';

writeFileSync(CEDAR_SCHEMA_URL, `${JSON.stringify(buildCedarSchema(), null, 2)}\n`);
