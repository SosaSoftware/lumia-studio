import { Duration, RemovalPolicy, Validations } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { REPO_ROOT, repoPath } from '../paths';

/** A file or folder the function reads next to its bundle, both paths relative to the repository root and the bundle. */
export interface BundledFile {
  readonly from: string;
  readonly to: string;
}

export interface StudioFunctionProps {
  readonly description: string;
  /** Source file of the handler, relative to the repository root. */
  readonly entry: string;
  /** Name of the exported handler. */
  readonly handler: string;
  readonly environment?: Readonly<Record<string, string>>;
  readonly memorySize?: number;
  readonly timeout?: Duration;
  readonly files?: readonly BundledFile[];
}

/** The Lambda runtime of Studio. */
export const STUDIO_RUNTIME: lambda.Runtime = lambda.Runtime.NODEJS_24_X;

/**
 * CommonJS dependencies (pg, cedar-wasm) inside an ESM bundle use `require`, `__filename` and `__dirname`;
 * cedar-wasm reads its `.wasm` file from `__dirname`.
 */
const ESM_BANNER = [
  "import { createRequire as __studioRequire } from 'node:module';",
  "import { fileURLToPath as __studioPath } from 'node:url';",
  "import { dirname as __studioDir } from 'node:path';",
  'const require = __studioRequire(import.meta.url);',
  'const __filename = __studioPath(import.meta.url);',
  'const __dirname = __studioDir(__filename);',
].join(' ');

function quote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * A Lambda function of Lumia Studio: Node.js on ARM, an ESM bundle built with esbuild from the workspace sources,
 * its own log group with a retention, X-Ray tracing and a role that only has the grants given to it.
 */
export class StudioFunction extends Construct {
  public readonly fn: NodejsFunction;
  public readonly role: iam.Role;

  public constructor(scope: Construct, id: string, props: StudioFunctionProps) {
    super(scope, id);
    const logGroup = new logs.LogGroup(this, 'Logs', { retention: logs.RetentionDays.ONE_MONTH, removalPolicy: RemovalPolicy.DESTROY });
    this.role = new iam.Role(this, 'Role', { assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'), description: props.description });
    logGroup.grantWrite(this.role);
    const files = props.files ?? [];
    this.fn = new NodejsFunction(this, 'Function', {
      description: props.description,
      entry: repoPath(props.entry),
      handler: props.handler,
      runtime: STUDIO_RUNTIME,
      architecture: lambda.Architecture.ARM_64,
      memorySize: props.memorySize ?? 512,
      timeout: props.timeout ?? Duration.seconds(30),
      role: this.role,
      logGroup,
      tracing: lambda.Tracing.ACTIVE,
      environment: { NODE_OPTIONS: '--enable-source-maps', ...props.environment },
      projectRoot: REPO_ROOT,
      depsLockFilePath: repoPath('package-lock.json'),
      bundling: {
        format: OutputFormat.ESM,
        target: 'node24',
        mainFields: ['module', 'main'],
        minify: true,
        sourceMap: true,
        sourcesContent: false,
        banner: ESM_BANNER,
        // Optional native driver of pg; never loaded.
        externalModules: ['pg-native'],
        ...(files.length === 0
          ? {}
          : {
              commandHooks: {
                beforeBundling: (): string[] => [],
                beforeInstall: (): string[] => [],
                afterBundling: (inputDir: string, outputDir: string): string[] =>
                  files.map((file) => `cp -R ${quote(`${inputDir}/${file.from}`)} ${quote(`${outputDir}/${file.to}`)}`),
              },
            }),
      },
    });
    Validations.of(this.role).acknowledge({
      id: 'AwsSolutions-IAM5[Resource::*]',
      reason: 'X-Ray (and Polly, for the narration function) only take "*" as resource.',
    });
  }
}
