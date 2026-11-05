import { Config, ProcessEnvSource } from '@lumia/api/config';
import { createDatabase } from '@lumia/api/db';
import type { CloseableDatabase, SqlValue } from '@lumia/api/db';

/** Emails of the people of a fixture; the sandbox login issues their tokens. */
export interface FixturePeople {
  /** Content creator with access to the fixture category. */
  readonly creator: string;
  /** Viewer with access to the fixture category. */
  readonly viewer: string;
}

/** A class of the fixture tree. */
export interface FixtureClass {
  readonly nodeId: string;
  readonly displayName: string;
}

const PREFIX = /^[a-z][a-z0-9-]{2,30}$/;

/**
 * Test content of its own on the sandbox Postgres: a category with one subcategory and empty classes, and two people
 * with access to it. Tests create it, use it through Studio like anyone else, and remove it; the seeded demo content
 * is never touched. Names and emails carry the prefix, so a fixture left by a crashed run is removed by the next one.
 */
export class StudioFixture {
  private constructor(
    private readonly admin: CloseableDatabase,
    public readonly prefix: string,
    public readonly categoryId: string,
    public readonly subcategoryId: string,
    public readonly classes: readonly FixtureClass[],
    public readonly people: FixturePeople,
  ) {}

  /**
   * @param prefix - Lowercase name of the fixture, such as `itest-lumi`.
   * @param classNames - Display names of the empty classes to create, in tree order.
   */
  public static async create(prefix: string, classNames: readonly string[]): Promise<StudioFixture> {
    if (!PREFIX.test(prefix)) {
      throw new RangeError(`The fixture prefix "${prefix}" must be 3 to 31 lowercase letters, digits or "-".`);
    }
    const admin = createDatabase('admin', new Config(new ProcessEnvSource()));
    try {
      await StudioFixture.removeContent(admin, prefix);
      const insertId = async (sql: string, params: Readonly<Record<string, SqlValue>>): Promise<string> => {
        const [row] = await admin.query<{ id: string }>(sql, params);
        if (row === undefined) throw new Error(`No id from: ${sql}`);
        return row.id;
      };
      const categoryId = await insertId('insert into studio.category (name, display_name) values (:name, :display) returning id::text as id', { name: prefix, display: `Pruebas ${prefix}` });
      const subcategoryId = await insertId(
        `insert into studio.subcategory (category_id, name, display_name) values (:category::uuid, 'pruebas', 'Pruebas') returning id::text as id`,
        { category: categoryId },
      );
      const classes: FixtureClass[] = [];
      for (const [index, displayName] of classNames.entries()) {
        const nodeId = await insertId(
          `insert into studio.tree_node (subcategory_id, parent_id, kind, name, display_name, position)
           values (:subcategory::uuid, null, 'class', :name, :display, :position) returning id::text as id`,
          { subcategory: subcategoryId, name: `clase-${String(index + 1)}.lumia`, display: displayName, position: index + 1 },
        );
        classes.push({ nodeId, displayName });
      }
      const people: FixturePeople = { creator: `creadora@${prefix}.test`, viewer: `lectora@${prefix}.test` };
      for (const [email, name, role] of [
        [people.creator, 'Creadora de pruebas', 'content_creator'],
        [people.viewer, 'Lectora de pruebas', 'viewer'],
      ] as const) {
        const userId = await insertId('insert into studio.app_user (email, name, role_id) select :email, :name, id from studio.role where key = :role returning id::text as id', {
          email,
          name,
          role,
        });
        await admin.execute('insert into studio.access_grant (user_id, category_id) values (:user::uuid, :category::uuid)', { user: userId, category: categoryId });
      }
      return new StudioFixture(admin, prefix, categoryId, subcategoryId, classes, people);
    } catch (error) {
      await admin.close();
      throw error;
    }
  }

  /** Removes the content and the people of the fixture. */
  public async remove(): Promise<void> {
    try {
      await StudioFixture.removeContent(this.admin, this.prefix);
    } finally {
      await this.admin.close();
    }
  }

  private static async removeContent(admin: CloseableDatabase, prefix: string): Promise<void> {
    await admin.execute(
      `delete from studio.class_document d using studio.tree_node n, studio.subcategory s, studio.category c
        where d.node_id = n.id and n.subcategory_id = s.id and s.category_id = c.id and c.name = :name`,
      { name: prefix },
    );
    await admin.execute('delete from studio.category where name = :name', { name: prefix });
    await admin.execute('delete from studio.app_user where email like :pattern', { pattern: `%@${prefix}.test` });
  }
}
