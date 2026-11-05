import type { AppSyncResolverEvent } from '../graphql/appsync/index.ts';
import type { StudioClaims } from '../auth/index.ts';
import { parseStudioClaims } from '../authorization/index.ts';
import { AppError } from '../shared/errors/index.ts';
import { InputReader } from './input-reader.ts';

/** What a command needs from an AppSync event: the caller, their bearer token and the arguments. */
export class StudioCall {
  private constructor(
    public readonly claims: StudioClaims,
    public readonly token: string,
    public readonly args: InputReader,
  ) {}

  public static from(event: AppSyncResolverEvent): StudioCall {
    const claims = event.identity === null ? null : parseStudioClaims(event.identity.claims);
    if (claims === null) {
      throw AppError.unauthorized('No tienes permiso para realizar esta acción.');
    }
    return new StudioCall(claims, StudioCall.bearerToken(event.request.headers), new InputReader(event.arguments));
  }

  /** AppSync forwards the raw token; the local server forwards `Bearer <token>`. */
  private static bearerToken(headers: Readonly<Record<string, string>>): string {
    const entry = Object.entries(headers).find(([name]) => name.toLowerCase() === 'authorization');
    return entry === undefined ? '' : entry[1].replace(/^Bearer\s+/i, '');
  }
}
