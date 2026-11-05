import { ClaimsBuilder } from '@lumia/api/auth';
import type { Database } from '@lumia/api/db';
import type { Logger } from '@lumia/api/log';
import { DocumentService, NarrationService, SlideService, TimelineService } from '@lumia/api/services';
import type { SpeechSynthesizer } from '@lumia/api/speech';
import type { ObjectStorage } from '@lumia/api/storage';
import type { SeedCategory, SeedNode, SeedPerson, SeedRole } from './seed-data.ts';
import { SHOWCASE_AUTHOR, SHOWCASE_CLASS } from './seed-data.ts';
import { SHOWCASE_NARRATION, SHOWCASE_PAUSE, SHOWCASE_SLIDES } from './showcase.ts';

export interface SeedInput {
  roles: readonly SeedRole[];
  categories: readonly SeedCategory[];
  people: readonly SeedPerson[];
}

export interface SeedSummary {
  roles: number;
  categories: number;
  nodes: number;
  people: number;
  showcase: 'created' | 'kept';
}

/** Dependencies of the API services that write the showcase content. */
export interface ContentDependencies {
  db: Database;
  storage: ObjectStorage;
  speech: SpeechSynthesizer;
  logger: Logger;
}

/**
 * Writes the sandbox data. Every record is upserted by its logical key (role key, names, email), so running the seed
 * again updates the data and keeps the content that people created.
 */
export class SandboxSeeder {
  private nodeCount = 0;

  public constructor(private readonly admin: Database) {}

  public async seed(input: SeedInput, content: ContentDependencies): Promise<SeedSummary> {
    await this.admin.transaction(async (tx) => {
      for (const role of input.roles) {
        await SandboxSeeder.writeRole(tx, role);
      }
      for (const [index, category] of input.categories.entries()) {
        await this.writeCategory(tx, category, index + 1);
      }
      for (const person of input.people) {
        await SandboxSeeder.writePerson(tx, person);
      }
    });
    const showcase = await SandboxSeeder.writeShowcase(this.admin, content);
    return { roles: input.roles.length, categories: input.categories.length, nodes: this.nodeCount, people: input.people.length, showcase };
  }

  private static async writeRole(tx: Database, role: SeedRole): Promise<void> {
    const roleId = await SandboxSeeder.id(
      tx,
      `insert into studio.role (key, name, description) values (:key, :name, :description)
       on conflict (key) do update set name = excluded.name, description = excluded.description
       returning id::text as id`,
      { key: role.key, name: role.name, description: role.description },
    );
    await tx.execute('delete from studio.role_permission where role_id = :roleId::uuid', { roleId });
    for (const action of role.actions) {
      await tx.execute('insert into studio.role_permission (role_id, permission_key) values (:roleId::uuid, :action)', { roleId, action });
    }
  }

  private async writeCategory(tx: Database, category: SeedCategory, position: number): Promise<void> {
    const categoryId = await SandboxSeeder.id(
      tx,
      `insert into studio.category (name, display_name, description, group_name, position) values (:name, :displayName, :description, :groupName, :position)
       on conflict (name) do update
         set display_name = excluded.display_name, description = excluded.description, group_name = excluded.group_name, position = excluded.position
       returning id::text as id`,
      { name: category.name, displayName: category.displayName, description: category.description ?? '', groupName: category.group ?? null, position },
    );
    for (const [index, subcategory] of category.subcategories.entries()) {
      const subcategoryId = await SandboxSeeder.id(
        tx,
        `insert into studio.subcategory (category_id, name, display_name, description, group_name, position)
         values (:categoryId::uuid, :name, :displayName, :description, :groupName, :position)
         on conflict (category_id, name) do update
           set display_name = excluded.display_name, description = excluded.description, group_name = excluded.group_name, position = excluded.position
         returning id::text as id`,
        {
          categoryId,
          name: subcategory.name,
          displayName: subcategory.displayName,
          description: subcategory.description ?? '',
          groupName: subcategory.group ?? null,
          position: index + 1,
        },
      );
      await this.writeNodes(tx, subcategoryId, null, subcategory.tree);
    }
  }

  private async writeNodes(tx: Database, subcategoryId: string, parentId: string | null, nodes: readonly SeedNode[]): Promise<void> {
    for (const [index, node] of nodes.entries()) {
      const nodeId = await SandboxSeeder.id(
        tx,
        `insert into studio.tree_node (subcategory_id, parent_id, kind, name, display_name, description, position)
         values (:subcategoryId::uuid, :parentId::uuid, :kind::studio.tree_node_kind, :name, :displayName, :description, :position)
         on conflict on constraint tree_node_sibling_name_key do update
           set display_name = excluded.display_name, description = excluded.description, position = excluded.position
         returning id::text as id`,
        { subcategoryId, parentId, kind: node.kind, name: node.name, displayName: node.displayName, description: node.description ?? '', position: index + 1 },
      );
      this.nodeCount += 1;
      if (node.kind === 'folder') {
        await this.writeNodes(tx, subcategoryId, nodeId, node.children);
      }
    }
  }

  /** Upserts the person with the role, and replaces the grants with the seed ones. */
  private static async writePerson(tx: Database, person: SeedPerson): Promise<void> {
    const userId = await SandboxSeeder.id(
      tx,
      `insert into studio.app_user (email, name, role_id)
       values (:email, :name, (select id from studio.role where key = :role))
       on conflict (email) do update set name = excluded.name, role_id = excluded.role_id, status = 'active'
       returning id::text as id`,
      { email: person.email, name: person.name, role: person.role },
    );
    await tx.execute('delete from studio.access_grant where user_id = :userId::uuid', { userId });
    for (const grant of person.grants) {
      const [category = '', subcategory] = grant.split('/');
      if (subcategory === undefined) {
        await tx.execute(
          `insert into studio.access_grant (user_id, category_id) select :userId::uuid, id from studio.category where name = :category`,
          { userId, category },
        );
      } else {
        await tx.execute(
          `insert into studio.access_grant (user_id, subcategory_id)
           select :userId::uuid, s.id from studio.subcategory s join studio.category c on c.id = s.category_id
            where c.name = :category and s.name = :subcategory`,
          { userId, category, subcategory },
        );
      }
    }
  }

  /** Fills the showcase class through the API services, as its author would; a class that has content is kept. */
  private static async writeShowcase(admin: Database, content: ContentDependencies): Promise<'created' | 'kept'> {
    const nodeId = await SandboxSeeder.showcaseNode(admin);
    const existing = await admin.query<{ id: string }>('select id::text as id from studio.class_document where node_id = :nodeId::uuid', { nodeId });
    if (existing.length > 0) {
      return 'kept';
    }
    const { db, storage, speech, logger } = content;
    const author = await new ClaimsBuilder(db).build(SHOWCASE_AUTHOR, `seed:${SHOWCASE_AUTHOR}`);
    const document = await new DocumentService(db, storage).createDocument(author, nodeId);
    const slides = await new SlideService(db, storage).applySlidesDraft(author, document.editingVersion.id, undefined, SHOWCASE_SLIDES);
    const slideAt = (position: number): string => {
      const slide = slides[position - 1];
      if (slide === undefined) {
        throw new Error(`The showcase has no slide ${String(position)}`);
      }
      return slide.id;
    };
    const narration = new NarrationService(db, storage, speech, logger);
    for (const clip of SHOWCASE_NARRATION) {
      await narration.save(author, { slideId: slideAt(clip.slide), script: clip.script, startsAtS: clip.startsAtS, voice: null, speed: 1 });
    }
    await new TimelineService(db, storage).savePause(author, {
      slideId: slideAt(SHOWCASE_PAUSE.slide),
      startsAtS: SHOWCASE_PAUSE.startsAtS,
      durationS: SHOWCASE_PAUSE.durationS,
      message: SHOWCASE_PAUSE.message,
      onEnd: SHOWCASE_PAUSE.onEnd,
    });
    return 'created';
  }

  /** Follows the path of the showcase class from its subcategory. */
  private static async showcaseNode(admin: Database): Promise<string> {
    let parentId: string | null = null;
    let nodeId = '';
    for (const name of SHOWCASE_CLASS.path) {
      nodeId = await SandboxSeeder.id(
        admin,
        `select n.id::text as id from studio.tree_node n
           join studio.subcategory s on s.id = n.subcategory_id
           join studio.category c on c.id = s.category_id
          where c.name = :category and s.name = :subcategory and n.name = :name and n.parent_id is not distinct from :parentId::uuid`,
        { category: SHOWCASE_CLASS.category, subcategory: SHOWCASE_CLASS.subcategory, name, parentId },
      );
      parentId = nodeId;
    }
    return nodeId;
  }

  private static async id(db: Database, sql: string, params: Record<string, string | number | null>): Promise<string> {
    const row = (await db.query<{ id: string }>(sql, params))[0];
    if (row === undefined) {
      throw new Error(`The seed query returned no row: ${sql.slice(0, 60)}`);
    }
    return row.id;
  }
}
