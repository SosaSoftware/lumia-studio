import type { StudioClaims } from '../auth/index.ts';
import type { CategoryPageDto, MeDto, TreeNodeDto, TreeNodePageDto } from '../domain/dto.ts';
import type { Database } from '../infrastructure/db/index.ts';
import type { ObjectStorage } from '../infrastructure/storage/index.ts';
import type { TreeNodeRecord } from '../repositories/tree-repository.ts';
import { AppError } from '../shared/errors/index.ts';
import { decodeOffset, encodeOffset } from '../support/offset-token.ts';
import { StudioService } from './studio-service.ts';

export interface PageRequest {
  limit?: number;
  nextToken?: string;
}

const DEFAULT_CATEGORY_PAGE = 50;
const MAX_CATEGORY_PAGE = 200;
const DEFAULT_NODE_PAGE = 500;
const MAX_NODE_PAGE = 1000;

function limitOf(page: PageRequest, fallback: number, max: number): number {
  return Math.min(Math.max(page.limit ?? fallback, 1), max);
}

/** The content tree: categories with their subcategories, and the folders and classes of a subcategory. */
export class TreeService extends StudioService {
  public constructor(db: Database, storage: ObjectStorage) {
    super(db, storage);
  }

  /** The person and the actions of their role, as the claims carry them. */
  public me(claims: StudioClaims): Promise<MeDto> {
    return Promise.resolve({
      userId: claims.studio_user_id,
      email: claims.email,
      name: claims.name,
      role: claims.studio_role,
      roleName: claims.studio_role_name,
      actions: [...claims.studio_actions],
    });
  }

  /** Categories granted to the person, each with the granted subcategories. */
  public async categories(claims: StudioClaims, page: PageRequest): Promise<CategoryPageDto> {
    const limit = limitOf(page, DEFAULT_CATEGORY_PAGE, MAX_CATEGORY_PAGE);
    const offset = decodeOffset(page.nextToken);
    const rows = await this.repos.tree.categories(claims, limit + 1, offset);
    const categories = rows.slice(0, limit);
    const subcategories = await this.repos.tree.subcategories(claims, categories.map((category) => category.id));
    return {
      items: categories.map((category) => ({
        ...category,
        subcategories: subcategories.filter((subcategory) => subcategory.categoryId === category.id),
      })),
      nextToken: rows.length > limit ? encodeOffset(offset + limit) : null,
    };
  }

  public async treeNodes(subcategoryId: string, page: PageRequest): Promise<TreeNodePageDto> {
    const limit = limitOf(page, DEFAULT_NODE_PAGE, MAX_NODE_PAGE);
    const offset = decodeOffset(page.nextToken);
    const rows = await this.repos.tree.nodes(subcategoryId, limit + 1, offset);
    return { items: rows.slice(0, limit).map((record) => TreeService.toDto(record)), nextToken: rows.length > limit ? encodeOffset(offset + limit) : null };
  }

  private static toDto(record: TreeNodeRecord): TreeNodeDto {
    return { ...record };
  }
}

/** Returns the class node, or throws when the node does not exist or is a folder. */
export async function requireClassNode(find: (id: string) => Promise<TreeNodeRecord | null>, nodeId: string): Promise<TreeNodeRecord> {
  const node = await find(nodeId);
  if (node === null) {
    throw AppError.notFound('La clase no existe.');
  }
  if (node.kind !== 'class') {
    throw AppError.validation('nodeId: el nodo es una carpeta, no una clase.');
  }
  return node;
}
