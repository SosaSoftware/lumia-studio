import { describe, expect, it } from 'vitest';
import type { Database } from '../infrastructure/db/database.ts';
import { ClaimsBuilder } from './claims-builder.ts';
import { UnauthorizedError } from './unauthorized-error.ts';

class FakeDatabase implements Database {
  public constructor(private readonly user: Record<string, unknown> | undefined) {}

  public query<T>(sql: string): Promise<T[]> {
    const rows = ((): unknown[] => {
      if (sql.includes('from studio.app_user')) return this.user === undefined ? [] : [this.user];
      if (sql.includes('role_permission')) return [{ key: 'documents.edit' }, { key: 'documents.view' }];
      if (sql.includes('select category_id')) return [{ id: 'cat-1' }];
      if (sql.includes('select s.id')) return [{ id: 'sub-1' }, { id: 'sub-2' }];
      return [];
    })();
    // The fake returns canned rows keyed by the query text.
    return Promise.resolve(rows as T[]);
  }

  public execute(): Promise<number> {
    return Promise.resolve(0);
  }

  public transaction<T>(work: (tx: Database) => Promise<T>): Promise<T> {
    return work(this);
  }
}

const activeUser = { id: 'u1', email: 'ana@lumia.studio', name: 'Ana López', status: 'active', role_id: 'r1', role_key: 'content_creator', role_name: 'Creación de contenido' };

describe('ClaimsBuilder', () => {
  it('builds the claims from the role and the granted categories and subcategories', async () => {
    const claims = await new ClaimsBuilder(new FakeDatabase(activeUser)).build('ana@lumia.studio', 'sub-ana');
    expect(claims).toEqual({
      sub: 'sub-ana',
      email: 'ana@lumia.studio',
      name: 'Ana López',
      studio_user_id: 'u1',
      studio_role: 'content_creator',
      studio_role_name: 'Creación de contenido',
      studio_actions: ['documents.edit', 'documents.view'],
      studio_categories: ['cat-1'],
      studio_subcategories: ['sub-1', 'sub-2'],
    });
  });

  it('rejects an unknown or disabled account', async () => {
    await expect(new ClaimsBuilder(new FakeDatabase(undefined)).build('x@y.z', 'x')).rejects.toMatchObject({ reason: 'unknown_user' });
    const disabled = new FakeDatabase({ ...activeUser, status: 'disabled' });
    await expect(new ClaimsBuilder(disabled).build('ana@lumia.studio', 'x')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects an account without role as one without access to Studio', async () => {
    const db = new FakeDatabase({ ...activeUser, role_id: null, role_key: null });
    await expect(new ClaimsBuilder(db).build('ana@lumia.studio', 'x')).rejects.toMatchObject({
      reason: 'no_access',
      message: 'Tu cuenta no tiene acceso a Lumia Studio.',
    });
  });
});
