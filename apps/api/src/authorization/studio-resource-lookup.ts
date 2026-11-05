import type { Database } from '../infrastructure/db/index.ts';
import type { ResourceAttributes, ResourceLookup } from './resource-lookup.ts';

interface ScopeRow {
  category_id: string;
  subcategory_id: string | null;
}

const SCOPE = 's.category_id::text as category_id, s.id::text as subcategory_id';
/** Joins from a class document up to its subcategory. */
const DOCUMENT_TO_SUBCATEGORY = 'join studio.tree_node n on n.id = d.node_id join studio.subcategory s on s.id = n.subcategory_id';
const VERSION_TO_SUBCATEGORY = `join studio.class_document d on d.id = v.document_id ${DOCUMENT_TO_SUBCATEGORY}`;
const SLIDE_TO_SUBCATEGORY = `join studio.document_version v on v.id = sl.version_id ${VERSION_TO_SUBCATEGORY}`;

/** Query of a record that belongs to a slide (`e.slide_id`). */
function slideChild(table: string): string {
  return `select ${SCOPE} from studio.${table} e join studio.slide sl on sl.id = e.slide_id ${SLIDE_TO_SUBCATEGORY} where e.id = :id::uuid`;
}

/** Query of each resource type, from the record up to the category and subcategory that scope it; `:id` is the record id. */
const QUERIES: Readonly<Record<string, string>> = {
  category: 'select c.id::text as category_id, null as subcategory_id from studio.category c where c.id = :id::uuid',
  subcategory: `select ${SCOPE} from studio.subcategory s where s.id = :id::uuid`,
  node: `select ${SCOPE} from studio.tree_node n join studio.subcategory s on s.id = n.subcategory_id where n.id = :id::uuid`,
  document: `select ${SCOPE} from studio.class_document d ${DOCUMENT_TO_SUBCATEGORY} where d.id = :id::uuid`,
  version: `select ${SCOPE} from studio.document_version v ${VERSION_TO_SUBCATEGORY} where v.id = :id::uuid`,
  slide: `select ${SCOPE} from studio.slide sl ${SLIDE_TO_SUBCATEGORY} where sl.id = :id::uuid`,
  element: slideChild('slide_element'),
  pause: slideChild('pause'),
  audio: slideChild('audio_clip'),
  narration: slideChild('narration_clip'),
  comment: slideChild('slide_comment'),
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolves the category and subcategory of a Studio record. Media assets belong to a category only. */
export class StudioResourceLookup implements ResourceLookup {
  public constructor(private readonly db: Database) {}

  public async attributes(type: string, id: string): Promise<ResourceAttributes | null> {
    const query = QUERIES[type];
    if (query === undefined || !UUID.test(id)) {
      return null;
    }
    const row = (await this.db.query<ScopeRow>(query, { id }))[0];
    if (row === undefined) {
      return null;
    }
    return row.subcategory_id === null ? { category: row.category_id } : { category: row.category_id, subcategory: row.subcategory_id };
  }
}
