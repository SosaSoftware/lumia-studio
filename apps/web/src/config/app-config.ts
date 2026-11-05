/** Deployment settings read from `/config.json` at start-up; the sandbox writes it and AWS serves its own. */
export interface AppConfig {
  /** GraphQL endpoint of the Studio API. */
  apiUrl: string;
  /** `dev` uses the sandbox login; `cognito` the user pool of Lumia Studio. */
  authMode: 'dev' | 'cognito';
  /** AG-UI endpoint of Lumi, or null while Lumi is not connected. */
  lumiUrl: string | null;
  /** User pool and web client of Lumia Studio; present with `authMode: cognito`. */
  cognito?: { userPoolId: string; userPoolClientId: string };
}

export class ConfigError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** Validates the parsed `config.json`. */
export function parseConfig(raw: unknown): AppConfig {
  if (typeof raw !== 'object' || raw === null) throw new ConfigError('config.json no es un objeto.');
  const source: Record<string, unknown> = { ...raw };
  const apiUrl = source.apiUrl;
  if (typeof apiUrl !== 'string' || apiUrl === '') throw new ConfigError('config.json: falta "apiUrl".');
  const mode = source.authMode;
  if (mode !== 'dev' && mode !== 'cognito') throw new ConfigError('config.json: "authMode" debe ser dev o cognito.');
  const lumiUrl = typeof source.lumiUrl === 'string' && source.lumiUrl.trim() !== '' ? source.lumiUrl : null;
  if (mode === 'dev') return { apiUrl, authMode: mode, lumiUrl };
  const cognito: unknown = source.cognito;
  const pool = typeof cognito === 'object' && cognito !== null ? { ...cognito } : {};
  const userPoolId: unknown = 'userPoolId' in pool ? pool.userPoolId : undefined;
  const userPoolClientId: unknown = 'userPoolClientId' in pool ? pool.userPoolClientId : undefined;
  if (typeof userPoolId !== 'string' || userPoolId === '' || typeof userPoolClientId !== 'string' || userPoolClientId === '') {
    throw new ConfigError('config.json: con authMode cognito faltan "cognito.userPoolId" y "cognito.userPoolClientId".');
  }
  return { apiUrl, authMode: mode, lumiUrl, cognito: { userPoolId, userPoolClientId } };
}

/** Fetches and validates `/config.json`. */
export async function loadConfig(fetcher: typeof fetch = fetch): Promise<AppConfig> {
  const response = await fetcher('/config.json', { cache: 'no-store' });
  if (!response.ok) throw new ConfigError('No se pudo leer config.json.');
  return parseConfig(await response.json());
}
