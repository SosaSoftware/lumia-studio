/** Kinds of tool failure. Lumi reads `code` and tells the person `message`. */
export type ToolErrorCode = 'forbidden' | 'unauthenticated' | 'not_found' | 'invalid_input' | 'conflict' | 'unknown_tool' | 'unavailable';

/** Answer of a failed tool call. Tools never throw to the gateway: they answer with this shape. */
export interface ToolFailure {
  readonly error: { readonly code: ToolErrorCode; readonly message: string };
}

/** Start of every message for an action that the person's role does not allow. */
export const INSUFFICIENT_PERMISSIONS = 'Permisos insuficientes';

export class ToolError extends Error {
  public constructor(
    public readonly code: ToolErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ToolError';
  }

  /** Studio denied the action to the person; `detail` is Studio's explanation. */
  public static forbidden(detail: string): ToolError {
    const reason = detail.trim() === '' ? 'tu rol no permite esta acción.' : detail.charAt(0).toLocaleLowerCase('es') + detail.slice(1);
    return new ToolError('forbidden', `${INSUFFICIENT_PERMISSIONS}: ${reason}`);
  }

  public static unauthenticated(message = 'La sesión de la persona no es válida o venció; debe volver a iniciar sesión en Studio.'): ToolError {
    return new ToolError('unauthenticated', message);
  }

  public static notFound(message: string): ToolError {
    return new ToolError('not_found', message);
  }

  public static invalidInput(message: string): ToolError {
    return new ToolError('invalid_input', message);
  }

  public static conflict(message: string): ToolError {
    return new ToolError('conflict', message);
  }

  public static unavailable(message = 'Studio no pudo completar la acción. Intenta de nuevo en unos segundos.'): ToolError {
    return new ToolError('unavailable', message);
  }

  public toFailure(): ToolFailure {
    return { error: { code: this.code, message: this.message } };
  }
}
