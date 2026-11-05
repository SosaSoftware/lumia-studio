import { CfnOutput, Duration, RemovalPolicy, Stack, Validations } from 'aws-cdk-lib';
import type { StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as triggers from 'aws-cdk-lib/triggers';
import type { Construct } from 'constructs';
import { PrivateBucket } from '../constructs/private-bucket';
import { StudioFunction } from '../constructs/studio-function';
import type { DatabaseCapacity } from '../deploy-config';
import { acknowledge, nagArn } from '../nag';

export interface LumiaStudioDataStackProps extends StackProps {
  readonly database: DatabaseCapacity;
}

export const DATABASE_NAME = 'lumia_studio';

const DATA_API_ACTIONS = ['rds-data:ExecuteStatement', 'rds-data:BatchExecuteStatement', 'rds-data:BeginTransaction', 'rds-data:CommitTransaction', 'rds-data:RollbackTransaction'];

/** Access to the data that a function of another stack can get; each one is a managed policy of this stack. */
export type DataAccess = 'database' | 'mediaRead' | 'mediaUpload' | 'narrationAudio' | 'publishedWrite';

/**
 * Everything Lumia Studio keeps: the Aurora PostgreSQL database (Data API, scales to 0 when idle), the secret of the
 * app database user, the media library and the published classes. Deleting the stack keeps the data: the database
 * leaves a snapshot and the buckets stay.
 */
export class LumiaStudioDataStack extends Stack {
  public readonly cluster: rds.DatabaseCluster;
  /** Credentials of `studio_app`, the database user of the API. */
  public readonly appSecret: rds.DatabaseSecret;
  public readonly mediaBucket: s3.Bucket;
  /** The .lumia files of the published classes, at a path that follows the tree; versioned. */
  public readonly publishedBucket: s3.Bucket;
  public readonly databaseName = DATABASE_NAME;
  private readonly access = new Map<DataAccess, iam.ManagedPolicy>();

  public constructor(scope: Construct, id: string, props: LumiaStudioDataStackProps) {
    super(scope, id, { ...props, terminationProtection: true });
    const accessLogs = new PrivateBucket(this, 'AccessLogs', { kind: 'logs', retain: true, expireAfterDays: 90 });

    // Only the database lives in the network: the functions reach it through the Data API, so no NAT is needed.
    const vpc = new ec2.Vpc(this, 'Network', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [{ name: 'database', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 }],
      flowLogs: { all: { destination: ec2.FlowLogDestination.toS3(accessLogs, 'vpc-flow-logs/'), trafficType: ec2.FlowLogTrafficType.ALL } },
    });

    const { minAcu, maxAcu, autoPauseMinutes } = props.database;
    this.cluster = new rds.DatabaseCluster(this, 'Database', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({ version: rds.AuroraPostgresEngineVersion.VER_16_13 }),
      writer: rds.ClusterInstance.serverlessV2('Writer', { autoMinorVersionUpgrade: true }),
      serverlessV2MinCapacity: minAcu,
      serverlessV2MaxCapacity: maxAcu,
      ...(minAcu === 0 ? { serverlessV2AutoPauseDuration: Duration.minutes(autoPauseMinutes) } : {}),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      credentials: rds.Credentials.fromGeneratedSecret('lumia_admin'),
      defaultDatabaseName: DATABASE_NAME,
      enableDataApi: true,
      storageEncrypted: true,
      iamAuthentication: true,
      deletionProtection: true,
      backup: { retention: Duration.days(7) },
      removalPolicy: RemovalPolicy.SNAPSHOT,
    });
    const adminSecret = this.cluster.secret;
    if (adminSecret === undefined) throw new Error('The database cluster has no admin secret.');
    this.appSecret = new rds.DatabaseSecret(this, 'AppUserSecret', { username: 'studio_app' });

    // Migrations run on every deploy that changes them, after the database exists.
    const migrate = new StudioFunction(this, 'Migrate', {
      description: 'Applies the database migrations of Lumia Studio and sets the password of the app user.',
      entry: 'apps/api/src/lambda/migrate.ts',
      handler: 'handler',
      timeout: Duration.minutes(5),
      environment: {
        LUMIA_DB_DRIVER: 'data-api',
        LUMIA_DB_CLUSTER_ARN: this.cluster.clusterArn,
        LUMIA_DB_SECRET_ARN: adminSecret.secretArn,
        LUMIA_DB_APP_SECRET_ARN: this.appSecret.secretArn,
        LUMIA_DB_NAME: DATABASE_NAME,
        LUMIA_MIGRATIONS_DIR: '/var/task/migrations',
      },
      files: [{ from: 'apps/api/db/migrations', to: 'migrations' }],
    });
    this.grantDataApi(migrate.fn, adminSecret);
    this.appSecret.grantRead(migrate.fn);
    new triggers.Trigger(this, 'MigrateOnDeploy', { handler: migrate.fn, executeAfter: [this.cluster], executeOnHandlerChange: true, timeout: Duration.minutes(10) });

    this.mediaBucket = new PrivateBucket(this, 'Media', {
      kind: 'content',
      retain: true,
      accessLogs,
      logPrefix: 'media/',
      // The web uploads with presigned PUT URLs and some players read files with fetch; the URL is the permission.
      cors: [{ allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET, s3.HttpMethods.HEAD], allowedOrigins: ['*'], allowedHeaders: ['*'], exposedHeaders: ['ETag'], maxAge: 3600 }],
    });
    this.publishedBucket = new PrivateBucket(this, 'Published', { kind: 'content', retain: true, accessLogs, logPrefix: 'published/', versioned: true });

    new CfnOutput(this, 'DatabaseClusterArn', { value: this.cluster.clusterArn, description: 'Aurora cluster, for the query editor of the RDS console.' });
    new CfnOutput(this, 'DatabaseAdminSecretArn', { value: adminSecret.secretArn, description: 'Secret of lumia_admin, for loading data by hand.' });
    new CfnOutput(this, 'MediaBucketName', { value: this.mediaBucket.bucketName });
    new CfnOutput(this, 'PublishedBucketName', { value: this.publishedBucket.bucketName, description: 'The .lumia files of the published classes.' });

    this.createAccessPolicies();

    Validations.of(this.cluster).acknowledge({ id: 'AwsSolutions-RDS11', reason: 'The database has no network access at all; the functions use the Data API, so the port is not reachable.' });
    Validations.of(this.cluster.node.findChild('Secret')).acknowledge({ id: 'AwsSolutions-SMG4', reason: 'Rotation needs a function inside the VPC with NAT or endpoints; the MVP keeps no compute in the VPC.' });
    Validations.of(this.appSecret).acknowledge({ id: 'AwsSolutions-SMG4', reason: 'The migration function sets this password; rotating it is left for after the MVP.' });
  }

  /** Attaches the managed policy of one kind of access to the role of a function of another stack. */
  public grant(role: iam.IRole, ...kinds: readonly DataAccess[]): void {
    for (const kind of kinds) {
      const policy = this.access.get(kind);
      if (policy === undefined) throw new Error(`No access policy "${kind}"`);
      role.addManagedPolicy(policy);
    }
  }

  /**
   * The access policies live here, next to the data they open. Keys of media start with `media/` and narration
   * audio with `narration/`, as the API writes them.
   */
  private createAccessPolicies(): void {
    const media = this.mediaBucket;
    const policy = (kind: DataAccess, description: string, statements: iam.PolicyStatement[], wildcards: string[] = []): void => {
      const managed = new iam.ManagedPolicy(this, `${kind.charAt(0).toUpperCase()}${kind.slice(1)}Access`, { description, statements });
      if (wildcards.length > 0) acknowledge(managed, 'Object keys are created per upload, narration or class; access is limited to their prefix.', ...wildcards);
      this.access.set(kind, managed);
    };
    const mediaArn = nagArn(this.cfn(media));
    policy('database', 'Data API statements on the Studio database as studio_app.', [
      new iam.PolicyStatement({ actions: DATA_API_ACTIONS, resources: [this.cluster.clusterArn] }),
      new iam.PolicyStatement({ actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'], resources: [this.appSecret.secretArn] }),
    ]);
    policy(
      'mediaRead',
      'Reads media and narration audio, and lists the bucket so a missing object answers 404.',
      [
        new iam.PolicyStatement({ actions: ['s3:GetObject'], resources: [media.arnForObjects('media/*'), media.arnForObjects('narration/*')] }),
        new iam.PolicyStatement({ actions: ['s3:ListBucket'], resources: [media.bucketArn] }),
      ],
      [`AwsSolutions-IAM5[Resource::${mediaArn}/media/*]`, `AwsSolutions-IAM5[Resource::${mediaArn}/narration/*]`],
    );
    policy('mediaUpload', 'Uploads to the media library (presigned PUT URLs).', [new iam.PolicyStatement({ actions: ['s3:PutObject'], resources: [media.arnForObjects('media/*')] })], [
      `AwsSolutions-IAM5[Resource::${mediaArn}/media/*]`,
    ]);
    policy('narrationAudio', 'Writes the audio and speech marks of narration clips.', [new iam.PolicyStatement({ actions: ['s3:PutObject'], resources: [media.arnForObjects('narration/*')] })], [
      `AwsSolutions-IAM5[Resource::${mediaArn}/narration/*]`,
    ]);
    policy(
      'publishedWrite',
      'Writes the .lumia files of published classes.',
      [new iam.PolicyStatement({ actions: ['s3:PutObject'], resources: [this.publishedBucket.arnForObjects('*')] })],
      [`AwsSolutions-IAM5[Resource::${nagArn(this.cfn(this.publishedBucket))}/*]`],
    );
  }

  private cfn(bucket: s3.Bucket): s3.CfnBucket {
    const resource = bucket.node.defaultChild;
    if (!(resource instanceof s3.CfnBucket)) throw new Error(`${bucket.node.path} has no CfnBucket`);
    return resource;
  }

  /** Data API statements with the admin secret, for the migrations (CDK's `grantDataApiAccess` grants the cluster secret to anyone). */
  private grantDataApi(fn: iam.IGrantable, secret: secretsmanager.ISecret): void {
    fn.grantPrincipal.addToPrincipalPolicy(
      new iam.PolicyStatement({ actions: DATA_API_ACTIONS, resources: [this.cluster.clusterArn] }),
    );
    secret.grantRead(fn);
  }
}
