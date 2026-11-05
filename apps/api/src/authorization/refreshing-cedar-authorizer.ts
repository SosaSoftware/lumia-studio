import type { Schema } from '@cedar-policy/cedar-wasm/nodejs';
import type { AuthorizationDecision, AuthorizationRequest, Authorizer } from './authorizer.ts';
import { LocalCedarAuthorizer } from './local-cedar-authorizer.ts';

/** Policy text of every role, keyed by role key; `RolePolicies` reads it from the database. */
export interface PolicySource {
  load(): Promise<Record<string, string>>;
}

/** Changes to the permissions of a role apply within this time, like the access of each person. */
export const POLICIES_TTL_MS = 60_000;

/** Cedar in process with the policies of the roles, reloaded from the database when they are older than a minute. */
export class RefreshingCedarAuthorizer implements Authorizer {
  private current: { authorizer: LocalCedarAuthorizer; expiresAt: number } | null = null;
  private loading: Promise<LocalCedarAuthorizer> | null = null;

  public constructor(
    private readonly policies: PolicySource,
    private readonly schema: Schema,
    private readonly ttlMs: number = POLICIES_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  public async isAuthorized(request: AuthorizationRequest): Promise<AuthorizationDecision> {
    return (await this.authorizer()).isAuthorized(request);
  }

  private authorizer(): Promise<LocalCedarAuthorizer> {
    const current = this.current;
    if (current !== null && current.expiresAt > this.now()) return Promise.resolve(current.authorizer);
    // Concurrent requests share one load.
    this.loading ??= this.policies
      .load()
      .then((policies) => {
        const authorizer = new LocalCedarAuthorizer(policies, this.schema);
        this.current = { authorizer, expiresAt: this.now() + this.ttlMs };
        return authorizer;
      })
      .finally(() => {
        this.loading = null;
      });
    return this.loading;
  }
}
