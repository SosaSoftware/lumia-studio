/**
 * What Studio knows about the caller of one request. The token only identifies the person; `ClaimsResolver`
 * reads the role, actions and granted categories from the database, so a change applies without signing in again.
 */
export interface StudioClaims {
  sub: string;
  email: string;
  name: string;
  studio_user_id: string;
  studio_role: string;
  /** Name of the role as stored in `studio.role`, for the interface. */
  studio_role_name: string;
  studio_actions: string[];
  /** Categories the person can see: the ones granted whole and the ones that hold a granted subcategory. */
  studio_categories: string[];
  /** Subcategories whose tree and classes the person can open. */
  studio_subcategories: string[];
}
