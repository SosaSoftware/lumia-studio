import { ACTIONS, PERMISSION_CATALOG } from '../../src/auth/index.ts';
import type { Database } from '../../src/infrastructure/db/index.ts';

/** Records created by `TreeFixture.create`; every name starts with the fixture prefix. */
export interface TreeFixtureData {
  categoryId: string;
  otherCategoryId: string;
  aiSubcategoryId: string;
  mathSubcategoryId: string;
  otherSubcategoryId: string;
  folderId: string;
  /** Classes of the AI subcategory, one per group of tests, and one class of each other subcategory. */
  classes: { lifecycle: string; empty: string; editing: string; math: string; other: string };
  emails: { creator: string; mathCreator: string; viewer: string; outsider: string; withoutRole: string };
}

/**
 * Test data in the sandbox database, separate from the seed: a category with the AI and Math subcategories and a
 * second category, a small tree, test roles, people and grants. `remove` deletes all of it, documents included.
 */
export class TreeFixture {
  private readonly roleKey: string;

  /** @param prefix Lowercase letters, digits and hyphens, unique per test file (for example `itest-api`). */
  public constructor(
    private readonly admin: Database,
    private readonly prefix: string,
  ) {
    this.roleKey = prefix.replace(/-/g, '_');
  }

  public async create(): Promise<TreeFixtureData> {
    await this.remove();
    const p = this.prefix;
    const categoryId = await this.id(
      `insert into studio.category (name, display_name) values (:name, :displayName) returning id::text as id`,
      { name: p, displayName: 'Instituto de prueba' },
    );
    const otherCategoryId = await this.id(
      `insert into studio.category (name, display_name) values (:name, :displayName) returning id::text as id`,
      { name: `${p}-otra`, displayName: 'Otra categoría' },
    );
    const subcategory = (category: string, name: string, displayName: string): Promise<string> =>
      this.id(
        `insert into studio.subcategory (category_id, name, display_name) values (:category::uuid, :name, :displayName) returning id::text as id`,
        { category, name, displayName },
      );
    const aiSubcategoryId = await subcategory(categoryId, 'inteligencia-artificial', 'Inteligencia artificial');
    const mathSubcategoryId = await subcategory(categoryId, 'matematicas', 'Matemáticas');
    const otherSubcategoryId = await subcategory(otherCategoryId, 'ciencias', 'Ciencias');
    const node = (subcategoryId: string, parentId: string | null, kind: 'folder' | 'class', name: string, displayName: string, position: number): Promise<string> =>
      this.id(
        `insert into studio.tree_node (subcategory_id, parent_id, kind, name, display_name, description, position)
         values (:subcategoryId::uuid, :parentId::uuid, :kind::studio.tree_node_kind, :name, :displayName, :description, :position)
         returning id::text as id`,
        { subcategoryId, parentId, kind, name, displayName, description: `Descripción de ${displayName}`, position },
      );
    const folderId = await node(aiSubcategoryId, null, 'folder', 'primero', 'Primero', 1);
    const classes = {
      lifecycle: await node(aiSubcategoryId, folderId, 'class', 'ciclo-de-vida.lumia', 'Ciclo de vida', 1),
      empty: await node(aiSubcategoryId, folderId, 'class', 'sin-contenido.lumia', 'Sin contenido', 2),
      editing: await node(aiSubcategoryId, folderId, 'class', 'edicion.lumia', 'Edición', 3),
      math: await node(mathSubcategoryId, null, 'class', 'fracciones.lumia', 'Fracciones', 1),
      other: await node(otherSubcategoryId, null, 'class', 'celulas.lumia', 'Células', 1),
    };

    const creatorRole = await this.role('creator', PERMISSION_CATALOG.map((permission) => permission.key));
    const viewerRole = await this.role('viewer', [ACTIONS.documentsView]);
    const emails = {
      creator: `creadora@${p}.test`,
      mathCreator: `matematicas@${p}.test`,
      viewer: `lectora@${p}.test`,
      outsider: `otra@${p}.test`,
      withoutRole: `sin-rol@${p}.test`,
    };
    const person = (email: string, name: string, roleId: string | null): Promise<string> =>
      this.id(`insert into studio.app_user (email, name, role_id) values (:email, :name, :roleId::uuid) returning id::text as id`, { email, name, roleId });
    const grant = async (userId: string, target: { categoryId?: string; subcategoryId?: string }): Promise<void> => {
      await this.admin.execute(
        `insert into studio.access_grant (user_id, category_id, subcategory_id) values (:userId::uuid, :categoryId::uuid, :subcategoryId::uuid)`,
        { userId, categoryId: target.categoryId ?? null, subcategoryId: target.subcategoryId ?? null },
      );
    };
    await grant(await person(emails.creator, 'Creadora de prueba', creatorRole), { categoryId });
    await grant(await person(emails.mathCreator, 'Creador de Matemáticas', creatorRole), { subcategoryId: mathSubcategoryId });
    await grant(await person(emails.viewer, 'Lectora de prueba', viewerRole), { categoryId });
    await grant(await person(emails.outsider, 'Creadora de otra categoría', creatorRole), { categoryId: otherCategoryId });
    await person(emails.withoutRole, 'Persona sin rol', null);
    return { categoryId, otherCategoryId, aiSubcategoryId, mathSubcategoryId, otherSubcategoryId, folderId, classes, emails };
  }

  /** Deletes the documents, media, tree, people and roles of the fixture. */
  public async remove(): Promise<void> {
    const pattern = `${this.prefix}%`;
    await this.admin.execute(
      `delete from studio.class_document d using studio.tree_node n, studio.subcategory s, studio.category c
        where d.node_id = n.id and n.subcategory_id = s.id and s.category_id = c.id and c.name like :pattern`,
      { pattern },
    );
    await this.admin.execute(
      'delete from studio.media_asset m using studio.category c where m.category_id = c.id and c.name like :pattern',
      { pattern },
    );
    await this.admin.execute('delete from studio.category where name like :pattern', { pattern });
    await this.admin.execute('delete from studio.app_user where email like :pattern', { pattern: `%@${this.prefix}.test` });
    await this.admin.execute('delete from studio.role where key like :pattern', { pattern: `${this.roleKey}%` });
  }

  private async role(name: string, actions: readonly string[]): Promise<string> {
    const roleId = await this.id(
      `insert into studio.role (key, name) values (:key, :name) returning id::text as id`,
      { key: `${this.roleKey}_${name}`, name: `Rol de prueba ${name}` },
    );
    for (const action of actions) {
      await this.admin.execute('insert into studio.role_permission (role_id, permission_key) values (:roleId::uuid, :action)', { roleId, action });
    }
    return roleId;
  }

  private async id(sql: string, params: Record<string, string | number | null>): Promise<string> {
    const row = (await this.admin.query<{ id: string }>(sql, params))[0];
    if (row === undefined) {
      throw new Error('The fixture insert returned no id');
    }
    return row.id;
  }
}
