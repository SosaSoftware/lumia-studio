import type { Database } from './database.ts';

const ROLE_PATTERN = /^[a-z_][a-z0-9_]*$/;

/** Assigns passwords to the application database users created by migration `0000`. */
export class RoleProvisioner {
  public constructor(private readonly db: Database) {}

  /**
   * `alter role` accepts no bind parameters, so the statement is built by the server with `format(%I, %L)`,
   * which quotes the identifier and the literal safely.
   */
  public async setPassword(role: string, password: string): Promise<void> {
    if (!ROLE_PATTERN.test(role)) {
      throw new Error(`Invalid role name "${role}"`);
    }
    const rows = await this.db.query<{ statement: string }>(
      `select format('alter role %I password %L', cast(:role as text), cast(:password as text)) as statement`,
      { role, password },
    );
    const statement = rows[0]?.statement;
    if (statement === undefined) {
      throw new Error('Could not build the alter role statement');
    }
    await this.db.execute(statement);
  }
}
