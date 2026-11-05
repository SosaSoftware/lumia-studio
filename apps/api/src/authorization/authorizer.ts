import type { StudioClaims } from '../auth/index.ts';
import type { ResourceAttributes } from './resource-lookup.ts';

export interface AuthorizationRequest {
  claims: StudioClaims;
  action: string;
  resource?: { type: string; id: string } & ResourceAttributes;
}

export interface AuthorizationDecision {
  allowed: boolean;
  reasons: string[];
}

/** Authorization contract. Locally it is Cedar in process; in AWS, Amazon Verified Permissions. */
export interface Authorizer {
  isAuthorized(request: AuthorizationRequest): Promise<AuthorizationDecision>;
}
