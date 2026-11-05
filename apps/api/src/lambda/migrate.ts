import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { DatabaseFactory, Migrator, RoleProvisioner } from '../infrastructure/db/index.ts';
import { Config, ProcessEnvSource } from '../shared/config/index.ts';
import { Logger } from '../shared/log/index.ts';

/** Reads the password of a Secrets Manager secret in the RDS format (`{ "username", "password" }`). */
export async function secretPassword(client: SecretsManagerClient, secretArn: string): Promise<string> {
  const answer = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const parsed: unknown = JSON.parse(answer.SecretString ?? '{}');
  const password = typeof parsed === 'object' && parsed !== null && 'password' in parsed ? parsed.password : undefined;
  if (typeof password !== 'string' || password === '') throw new Error('The secret of the app database user has no password.');
  return password;
}

/**
 * Runs on every deploy that changes the migrations (CDK trigger). It applies them through the Data API with the admin
 * secret (`LUMIA_DB_SECRET_ARN`), then gives `studio_app` the password of its own secret, which the API uses.
 */
export async function handler(): Promise<{ applied: string[] }> {
  const logger = new Logger({ service: 'lumia-studio-migrate' });
  const config = new Config(new ProcessEnvSource());
  const db = new DatabaseFactory(config).create('admin');
  try {
    const applied = await new Migrator(db, 'studio', config.required('LUMIA_MIGRATIONS_DIR')).run();
    await new RoleProvisioner(db).setPassword('studio_app', await secretPassword(new SecretsManagerClient({}), config.required('LUMIA_DB_APP_SECRET_ARN')));
    logger.info('studio migrations applied', { applied });
    return { applied };
  } finally {
    await db.close();
  }
}
