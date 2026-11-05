/** Capacity of Aurora Serverless v2, in ACU (about 2 GiB of memory each). */
export interface DatabaseCapacity {
  /** 0 lets the database pause when nobody uses it. */
  readonly minAcu: number;
  readonly maxAcu: number;
  /** Minutes without connections before it pauses; only with `minAcu` 0. */
  readonly autoPauseMinutes: number;
}

/** What `bin/` reads from `.env` and the shell to deploy Lumia Studio; another account only changes these values. */
export interface DeployConfig {
  /** Account and region of the stacks; empty means the ones of the AWS CLI profile. */
  readonly env: { readonly account?: string; readonly region?: string };
  readonly database: DatabaseCapacity;
  /** AG-UI endpoint of Lumi for the web; null while Lumi is not deployed. */
  readonly lumiUrl: string | null;
}

export class DeployConfigError extends Error {
  public constructor(variable: string, message: string) {
    super(`${variable}: ${message}`);
    this.name = 'DeployConfigError';
  }
}

type Env = Readonly<Record<string, string | undefined>>;

function value(env: Env, name: string): string | undefined {
  const raw = env[name]?.trim();
  return raw === undefined || raw === '' ? undefined : raw;
}

/** ACU go in steps of 0.5. */
function acu(env: Env, name: string, fallback: number, min: number): number {
  const raw = value(env, name);
  const parsed = raw === undefined ? fallback : Number(raw);
  if (!Number.isFinite(parsed) || parsed < min || parsed > 256 || (parsed * 2) % 1 !== 0) {
    throw new DeployConfigError(name, `must be between ${String(min)} and 256 ACU, in steps of 0.5.`);
  }
  return parsed;
}

function minutes(env: Env, name: string, fallback: number): number {
  const raw = value(env, name);
  const parsed = raw === undefined ? fallback : Number(raw);
  // Aurora pauses after 5 minutes to 24 hours without connections.
  if (!Number.isInteger(parsed) || parsed < 5 || parsed > 1440) {
    throw new DeployConfigError(name, 'must be a whole number of minutes between 5 and 1440.');
  }
  return parsed;
}

function lumiUrl(env: Env): string | null {
  const raw = value(env, 'LUMIA_LUMI_URL');
  if (raw === undefined) return null;
  // A path such as /lumi/invocations is served by the CloudFront distribution of the web.
  if (raw.startsWith('/')) return raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new DeployConfigError('LUMIA_LUMI_URL', 'must be an https URL or a path of the web, such as /lumi/invocations.');
  }
  if (url.protocol !== 'https:') throw new DeployConfigError('LUMIA_LUMI_URL', 'must use https.');
  return raw;
}

/** Reads and validates the deployment settings. */
export function readDeployConfig(env: Env): DeployConfig {
  const account = value(env, 'LUMIA_AWS_ACCOUNT') ?? value(env, 'CDK_DEFAULT_ACCOUNT');
  const region = value(env, 'LUMIA_AWS_REGION') ?? value(env, 'CDK_DEFAULT_REGION');
  if (account !== undefined && !/^\d{12}$/.test(account)) throw new DeployConfigError('LUMIA_AWS_ACCOUNT', 'must have 12 digits.');
  if (region !== undefined && !/^[a-z]{2}(-[a-z]+)+-\d$/.test(region)) throw new DeployConfigError('LUMIA_AWS_REGION', 'must be a region code such as us-east-1.');
  const minAcu = acu(env, 'LUMIA_DB_MIN_ACU', 0, 0);
  const maxAcu = acu(env, 'LUMIA_DB_MAX_ACU', 1, 1);
  if (maxAcu < minAcu) throw new DeployConfigError('LUMIA_DB_MAX_ACU', 'must be greater than or equal to LUMIA_DB_MIN_ACU.');
  return {
    env: { ...(account === undefined ? {} : { account }), ...(region === undefined ? {} : { region }) },
    database: { minAcu, maxAcu, autoPauseMinutes: minutes(env, 'LUMIA_DB_AUTO_PAUSE_MINUTES', 5) },
    lumiUrl: lumiUrl(env),
  };
}
