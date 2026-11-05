import { createDatabase } from '@lumia/api/db';
import { Config, loadEnvFileIfPresent, ProcessEnvSource } from '@lumia/api/config';
import { Logger } from '@lumia/api/log';
import { createSpeechSynthesizer } from '@lumia/api/speech';
import { createObjectStorage } from '@lumia/api/storage';
import { SandboxSeeder } from './sandbox-seeder.ts';
import { SEED_CATEGORIES, SEED_PEOPLE, SEED_ROLES } from './seed-data.ts';

loadEnvFileIfPresent(new URL('../../.env', import.meta.url));

const logger = new Logger({ script: 'sandbox-seed' });
const config = new Config(new ProcessEnvSource());
const admin = createDatabase('admin', config);
const db = createDatabase('studio_app', config);

try {
  const summary = await new SandboxSeeder(admin).seed(
    { roles: SEED_ROLES, categories: SEED_CATEGORIES, people: SEED_PEOPLE },
    { db, storage: createObjectStorage(config), speech: createSpeechSynthesizer(config), logger },
  );
  logger.info('sandbox seed applied', { ...summary });
} finally {
  await Promise.all([admin.close(), db.close()]);
}
