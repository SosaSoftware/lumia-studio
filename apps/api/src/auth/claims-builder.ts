import type { Database } from '../infrastructure/db/index.ts';
import type { StudioClaims } from './claims.ts';
import { UnauthorizedError } from './unauthorized-error.ts';

interface UserRow {
  id: string;
  email: string;
  name: string;
  status: string;
  role_id: string | null;
  role_key: string | null;
  role_name: string | null;
}

const UNKNOWN_USER = 'No existe una cuenta activa con ese correo.';
const NO_ACCESS = 'Tu cuenta no tiene acceso a Lumia Studio.';

/**
 * Builds the claims of a person from the Studio tables: role, actions and the categories and subcategories granted.
 * The Cognito pre token generation trigger uses it in AWS; the development login uses it in the sandbox.
 */
export class ClaimsBuilder {
  public constructor(private readonly db: Database) {}

  /**
   * @param sub Subject of the token: the Cognito user id in AWS, a development id in the sandbox.
   * @throws UnauthorizedError when no active account has the email, or the account has no role.
   */
  public async build(email: string, sub: string): Promise<StudioClaims> {
    const users = await this.db.query<UserRow>(
      `select u.id::text as id, u.email::text as email, u.name, u.status::text as status,
              r.id::text as role_id, r.key as role_key, r.name as role_name
         from studio.app_user u
         left join studio.role r on r.id = u.role_id
        where u.email = :email`,
      { email: email.trim() },
    );
    const user = users[0];
    if (user?.status !== 'active') {
      throw new UnauthorizedError(UNKNOWN_USER, 'unknown_user');
    }
    if (user.role_id === null || user.role_key === null) {
      throw new UnauthorizedError(NO_ACCESS, 'no_access');
    }
    const [actions, categories, subcategories] = await Promise.all([
      this.db.query<{ key: string }>(
        'select permission_key as key from studio.role_permission where role_id = :roleId::uuid order by permission_key',
        { roleId: user.role_id },
      ),
      this.db.query<{ id: string }>(
        `select category_id::text as id from studio.access_grant where user_id = :userId::uuid and category_id is not null
         union
         select s.category_id::text from studio.access_grant g join studio.subcategory s on s.id = g.subcategory_id
          where g.user_id = :userId::uuid
         order by 1`,
        { userId: user.id },
      ),
      this.db.query<{ id: string }>(
        `select s.id::text as id from studio.access_grant g join studio.subcategory s on s.category_id = g.category_id
          where g.user_id = :userId::uuid
         union
         select subcategory_id::text from studio.access_grant where user_id = :userId::uuid and subcategory_id is not null
         order by 1`,
        { userId: user.id },
      ),
    ]);
    return {
      sub,
      email: user.email,
      name: user.name,
      studio_user_id: user.id,
      studio_role: user.role_key,
      studio_role_name: user.role_name ?? user.role_key,
      studio_actions: actions.map((row) => row.key),
      studio_categories: categories.map((row) => row.id),
      studio_subcategories: subcategories.map((row) => row.id),
    };
  }
}
