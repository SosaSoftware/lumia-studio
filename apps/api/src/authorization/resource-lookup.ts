/** Scope of a record: the category and subcategory of the tree it belongs to. */
export interface ResourceAttributes {
  category?: string;
  subcategory?: string;
}

/** Resolves the scope attributes of a record. */
export interface ResourceLookup {
  /** Returns null when the record does not exist. */
  attributes(type: string, id: string): Promise<ResourceAttributes | null>;
}
