import { isAuthorized } from '@cedar-policy/cedar-wasm/nodejs';
import type { Schema } from '@cedar-policy/cedar-wasm/nodejs';
import type { AuthorizationDecision, AuthorizationRequest, Authorizer } from './authorizer.ts';

/** Evaluates the Cedar policies in process with cedar-wasm (sandbox replacement of Verified Permissions). */
export class LocalCedarAuthorizer implements Authorizer {
  /**
   * @param policiesByRole Cedar policy text keyed by role key; the key is the policy id.
   * @param schema Cedar schema used to validate requests and entities.
   */
  public constructor(
    private readonly policiesByRole: Readonly<Record<string, string>>,
    private readonly schema: Schema,
  ) {}

  public isAuthorized(request: AuthorizationRequest): Promise<AuthorizationDecision> {
    const { claims, resource } = request;
    const resourceId = resource?.id ?? 'none';
    const optional = (name: string, value: string | undefined): Record<string, string> =>
      value === undefined ? {} : { [name]: value };
    const answer = isAuthorized({
      principal: { type: 'Studio::User', id: claims.studio_user_id },
      action: { type: 'Studio::Action', id: request.action },
      resource: { type: 'Studio::Resource', id: resourceId },
      context: {},
      schema: this.schema,
      validateRequest: true,
      policies: { staticPolicies: { ...this.policiesByRole } },
      entities: [
        {
          uid: { type: 'Studio::User', id: claims.studio_user_id },
          attrs: { categories: claims.studio_categories, subcategories: claims.studio_subcategories },
          parents: [{ type: 'Studio::Role', id: claims.studio_role }],
        },
        { uid: { type: 'Studio::Role', id: claims.studio_role }, attrs: {}, parents: [] },
        {
          uid: { type: 'Studio::Resource', id: resourceId },
          attrs: { ...optional('category', resource?.category), ...optional('subcategory', resource?.subcategory) },
          parents: [],
        },
      ],
    });
    if (answer.type === 'failure') {
      return Promise.reject(new Error(`Cedar evaluation failed: ${answer.errors.map((e) => e.message).join('; ')}`));
    }
    const { decision, diagnostics } = answer.response;
    return Promise.resolve({ allowed: decision === 'allow', reasons: diagnostics.reason });
  }
}
