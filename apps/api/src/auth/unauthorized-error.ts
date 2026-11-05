import { AppError } from '../shared/errors/index.ts';

/** Why a person cannot sign in: no active account with the email, or an account without access to Studio. */
export type SignInFailure = 'unknown_user' | 'no_access';

/** Raised when a person cannot be identified or is not allowed to sign in. */
export class UnauthorizedError extends AppError {
  public constructor(
    message: string,
    public readonly reason: SignInFailure = 'unknown_user',
  ) {
    super('Unauthorized', message);
    this.name = 'UnauthorizedError';
  }
}
