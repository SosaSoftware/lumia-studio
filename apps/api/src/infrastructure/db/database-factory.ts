import { RDSDataClient } from '@aws-sdk/client-rds-data';
import { Config, ProcessEnvSource } from '../../shared/config/index.ts';
import { AwsDataApiGateway } from './aws-data-api-gateway.ts';
import type { CloseableDatabase } from './closeable-database.ts';
import { DataApiDatabase } from './data-api-database.ts';
import { PgDatabase } from './pg-database.ts';

/** Database identities: the owner used by migrations and seeds, and one application user per schema. */
export type DatabaseRole = 'admin' | 'studio_app';

interface PgIdentity {
  readonly user: string;
  readonly passwordVariable: string;
}

const PG_IDENTITIES: Readonly<Record<DatabaseRole, PgIdentity>> = {
  admin: { user: 'lumia_admin', passwordVariable: 'LUMIA_SANDBOX_DB_PASSWORD' },
  studio_app: { user: 'studio_app', passwordVariable: 'LUMIA_DB_STUDIO_APP_PASSWORD' },
};

/**
 * Chooses the adapter from `LUMIA_DB_DRIVER` (`pg` by default, or `data-api`).
 * With the Data API the identity is defined by the secret in `LUMIA_DB_SECRET_ARN`, so `role` only matters for `pg`.
 */
export class DatabaseFactory {
  public constructor(private readonly config: Config) {}

  public create(role: DatabaseRole): CloseableDatabase {
    const driver = this.config.optional('LUMIA_DB_DRIVER', 'pg');
    switch (driver) {
      case 'pg':
        return this.createPg(role);
      case 'data-api':
        return this.createDataApi();
      default:
        throw new Error(`Unsupported LUMIA_DB_DRIVER "${driver}"; expected "pg" or "data-api"`);
    }
  }

  private createPg(role: DatabaseRole): PgDatabase {
    const identity = PG_IDENTITIES[role];
    return PgDatabase.connect({
      host: this.config.optional('LUMIA_PG_HOST', '127.0.0.1'),
      port: this.config.integer('LUMIA_PG_PORT', 5432),
      database: this.config.optional('LUMIA_DB_NAME', 'lumia_studio'),
      user: identity.user,
      password: this.config.required(identity.passwordVariable),
    });
  }

  private createDataApi(): DataApiDatabase {
    return new DataApiDatabase(new AwsDataApiGateway(new RDSDataClient({})), {
      resourceArn: this.config.required('LUMIA_DB_CLUSTER_ARN'),
      secretArn: this.config.required('LUMIA_DB_SECRET_ARN'),
      database: this.config.required('LUMIA_DB_NAME'),
    });
  }
}

/** Creates a database from process environment variables; `studio_app` by default, the identity of the API. */
export function createDatabase(role: DatabaseRole = 'studio_app', config: Config = new Config(new ProcessEnvSource())): CloseableDatabase {
  return new DatabaseFactory(config).create(role);
}
