import type { StudioClaims } from '../auth/index.ts';
import type { DocumentStatus, TreeNodeKind } from '../domain/dto.ts';
import type { Database } from '../infrastructure/db/index.ts';

export interface CategoryRecord {
  id: string;
  name: string;
  displayName: string;
  description: string;
  /** Heading that groups it in the menus; null when it has none. */
  groupName: string | null;
}

export interface SubcategoryRecord extends CategoryRecord {
  categoryId: string;
}

export interface TreeNodeRecord {
  id: string;
  subcategoryId: string;
  parentId: string | null;
  kind: TreeNodeKind;
  name: string;
  displayName: string;
  description: string;
  position: number;
  documentId: string | null;
  documentStatus: DocumentStatus | null;
  currentVersion: number | null;
  publishedVersion: number | null;
}

interface NamedRow {
  id: string;
  category_id: string;
  name: string;
  display_name: string;
  description: string;
  group_name: string | null;
}

interface NodeRow {
  id: string;
  subcategory_id: string;
  parent_id: string | null;
  kind: TreeNodeKind;
  name: string;
  display_name: string;
  description: string;
  position: number;
  document_id: string | null;
  document_status: 'draft' | 'published' | null;
  current_version: number | null;
  published_version: number | null;
}

const NODE_SELECT = `select n.id::text as id, n.subcategory_id::text as subcategory_id, n.parent_id::text as parent_id,
       n.kind::text as kind, n.name, n.display_name, n.description, n.position,
       d.id::text as document_id, d.status::text as document_status, d.current_version, d.published_version
  from studio.tree_node n
  left join studio.class_document d on d.node_id = n.id`;

function toNode(row: NodeRow): TreeNodeRecord {
  const isClass = row.kind === 'class';
  return {
    id: row.id,
    subcategoryId: row.subcategory_id,
    parentId: row.parent_id,
    kind: row.kind,
    name: row.name,
    displayName: row.display_name,
    description: row.description,
    position: row.position,
    documentId: row.document_id,
    documentStatus: isClass ? (row.document_status ?? 'no_content') : null,
    currentVersion: row.current_version,
    publishedVersion: row.published_version,
  };
}

/** Categories, subcategories and tree nodes. Lists only return what the claims grant. */
export class TreeRepository {
  public constructor(private readonly db: Database) {}

  /** Categories of the claims, in display order, from `offset`. */
  public async categories(claims: StudioClaims, limit: number, offset: number): Promise<CategoryRecord[]> {
    const rows = await this.db.query<Omit<NamedRow, 'category_id'>>(
      `select c.id::text as id, c.name, c.display_name, c.description, c.group_name
         from studio.category c
        where c.id::text = any(string_to_array(:ids, ','))
        order by c.position, c.display_name, c.id
        limit :limit offset :offset`,
      { ids: claims.studio_categories.join(','), limit, offset },
    );
    return rows.map((row) => ({ id: row.id, name: row.name, displayName: row.display_name, description: row.description, groupName: row.group_name }));
  }

  /** Subcategories of the claims that belong to the given categories, in display order. */
  public async subcategories(claims: StudioClaims, categoryIds: readonly string[]): Promise<SubcategoryRecord[]> {
    if (categoryIds.length === 0) {
      return [];
    }
    const rows = await this.db.query<NamedRow>(
      `select s.id::text as id, s.category_id::text as category_id, s.name, s.display_name, s.description, s.group_name
         from studio.subcategory s
        where s.id::text = any(string_to_array(:ids, ','))
          and s.category_id::text = any(string_to_array(:categoryIds, ','))
        order by s.position, s.display_name, s.id`,
      { ids: claims.studio_subcategories.join(','), categoryIds: categoryIds.join(',') },
    );
    return rows.map((row) => ({ id: row.id, categoryId: row.category_id, name: row.name, displayName: row.display_name, description: row.description, groupName: row.group_name }));
  }

  /** Nodes of a subcategory, ordered by position among siblings, from `offset`. */
  public async nodes(subcategoryId: string, limit: number, offset: number): Promise<TreeNodeRecord[]> {
    const rows = await this.db.query<NodeRow>(
      `${NODE_SELECT}
        where n.subcategory_id = :subcategoryId::uuid
        order by n.position, n.name, n.id
        limit :limit offset :offset`,
      { subcategoryId, limit, offset },
    );
    return rows.map(toNode);
  }

  public async node(nodeId: string): Promise<TreeNodeRecord | null> {
    const row = (await this.db.query<NodeRow>(`${NODE_SELECT} where n.id = :id::uuid`, { id: nodeId }))[0];
    return row === undefined ? null : toNode(row);
  }
}
