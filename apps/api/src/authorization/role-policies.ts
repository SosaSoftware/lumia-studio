import type { Database } from '../infrastructure/db/index.ts';
import { PolicyGenerator } from './policy-generator.ts';

interface RolePermissionRow {
  role_key: string;
  permission_key: string;
}

/** Builds the Cedar policy of every role from the permissions stored in `studio.role_permission`. */
export class RolePolicies {
  public constructor(private readonly db: Database) {}

  /** Policy text keyed by role key; roles without permissions have no policy. */
  public async load(): Promise<Record<string, string>> {
    const rows = await this.db.query<RolePermissionRow>(
      `select r.key as role_key, rp.permission_key
         from studio.role r
         join studio.role_permission rp on rp.role_id = r.id
        order by r.key, rp.permission_key`,
    );
    const actionsByRole = new Map<string, string[]>();
    for (const row of rows) {
      const actions = actionsByRole.get(row.role_key) ?? [];
      actions.push(row.permission_key);
      actionsByRole.set(row.role_key, actions);
    }
    const policies: Record<string, string> = {};
    for (const [role, actions] of actionsByRole) {
      const policy = PolicyGenerator.forRole(role, actions);
      if (policy !== null) {
        policies[role] = policy;
      }
    }
    return policies;
  }
}
