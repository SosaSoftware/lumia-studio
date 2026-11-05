/** The part of a Cognito pre token generation event (version 2) that the trigger reads and writes. */
export interface PreTokenGenerationEvent {
  request: { userAttributes: Readonly<Record<string, string | undefined>> };
  response: Record<string, unknown>;
}

/**
 * Adds the email of the person to the access token, so the Studio API (AppSync) and Lumi identify them with the
 * same token. It does not read the database: Cognito waits 5 seconds at most and the database may be paused.
 * Role, actions and access are read by the API on each request.
 */
export function handler(event: PreTokenGenerationEvent): Promise<PreTokenGenerationEvent> {
  const email = event.request.userAttributes.email;
  if (email !== undefined && email !== '') {
    event.response = { claimsAndScopeOverrideDetails: { accessTokenGeneration: { claimsToAddOrOverride: { email } } } };
  }
  return Promise.resolve(event);
}
