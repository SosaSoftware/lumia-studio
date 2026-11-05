import { fileURLToPath } from 'node:url';
import { DatabaseFactory, Migrator, RoleProvisioner } from '../src/infrastructure/db/index.ts';
import { Config, loadEnvFileIfPresent, ProcessEnvSource } from '../src/shared/config/index.ts';
import { Logger } from '../src/shared/log/index.ts';

loadEnvFileIfPresent(new URL('../../../.env', import.meta.url));

const logger = new Logger({ script: 'studio-migrate' });
const config = new Config(new ProcessEnvSource());
const db = new DatabaseFactory(config).create('admin');

try {
  const applied = await new Migrator(db, 'studio', fileURLToPath(new URL('../db/migrations', import.meta.url))).run();
  logger.info('studio migrations applied', { applied });
  // Locally the API signs in with a password; in AWS the Data API uses the secret of the cluster instead.
  if (config.optional('LUMIA_DB_DRIVER', 'pg') === 'pg') {
    await new RoleProvisioner(db).setPassword('studio_app', config.required('LUMIA_DB_STUDIO_APP_PASSWORD'));
    logger.info('database user password set', { role: 'studio_app' });
  }
} finally {
  await db.close();
}
