import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import * as path from 'node:path';
import { AssetHashType, CfnOutput, DockerImage, Duration, Stack, Validations } from 'aws-cdk-lib';
import type { StackProps } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import type { Construct } from 'constructs';
import { PrivateBucket } from '../constructs/private-bucket';
import { acknowledge, nagArn, nagAssetsBucketObjects } from '../nag';
import { repoPath } from '../paths';

export interface LumiaStudioWebStackProps extends StackProps {
  readonly graphqlUrl: string;
  readonly userPoolId: string;
  readonly userPoolClientId: string;
  /** AG-UI endpoint of Lumi; null while Lumi is not deployed. */
  readonly lumiUrl: string | null;
}

const WEB_DIR = repoPath('apps/web');

/**
 * The .lumia file that the public demo (`/demo`) plays, as a key of the demo bucket. Copy the published file there
 * with this key; to show another file, change it and deploy this stack again.
 */
export const DEMO_FILE_KEY = 'demo-content/demo.lumia';

/** Paths without a file extension are routes of the single-page app; they get index.html. */
const SPA_ROUTING = `function handler(event) {
  var request = event.request;
  var last = request.uri.split('/').pop();
  if (last.indexOf('.') === -1) {
    request.uri = '/index.html';
  }
  return request;
}`;

/** Builds the web with Vite into the asset folder, without the config.json of the sandbox. */
function buildWeb(outputDir: string): boolean {
  // The CLI is not an export of the vite package; its package.json names it.
  const manifest = require.resolve('vite/package.json', { paths: [WEB_DIR] });
  const vite = path.join(path.dirname(manifest), 'bin', 'vite.js');
  execFileSync(process.execPath, [vite, 'build', '--outDir', outputDir, '--emptyOutDir'], { cwd: WEB_DIR, stdio: 'inherit' });
  rmSync(path.join(outputDir, 'config.json'), { force: true });
  return true;
}

/**
 * The Studio web: a private bucket behind CloudFront (origin access control, HTTPS only, security headers), the build
 * of `apps/web` and the `config.json` of this deployment. It is the last stack, so a route to Lumi can be added later.
 */
export class LumiaStudioWebStack extends Stack {
  public readonly distribution: cloudfront.Distribution;
  private readonly siteBucket: s3.Bucket;

  public constructor(scope: Construct, id: string, props: LumiaStudioWebStackProps) {
    super(scope, id, props);
    const accessLogs = new PrivateBucket(this, 'AccessLogs', { kind: 'logs', retain: false, expireAfterDays: 90 });
    const site = new PrivateBucket(this, 'Site', { kind: 'content', retain: false, accessLogs, logPrefix: 'site/' });
    this.siteBucket = site;

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: 'Lumia Studio',
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(site),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        functionAssociations: [
          { eventType: cloudfront.FunctionEventType.VIEWER_REQUEST, function: new cloudfront.Function(this, 'SpaRouting', { code: cloudfront.FunctionCode.fromInline(SPA_ROUTING), runtime: cloudfront.FunctionRuntime.JS_2_0 }) },
        ],
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      enableLogging: true,
      logBucket: accessLogs,
      logFilePrefix: 'cloudfront/',
    });

    const build = s3deploy.Source.asset(WEB_DIR, {
      assetHashType: AssetHashType.OUTPUT,
      bundling: { image: DockerImage.fromRegistry('public.ecr.aws/docker/library/node:22'), local: { tryBundle: buildWeb } },
    });
    // Hashed files first and cached for a year; index.html and config.json after them, never cached.
    const assets = new s3deploy.BucketDeployment(this, 'DeployAssets', {
      sources: [build],
      destinationBucket: site,
      exclude: ['*'],
      include: ['assets/*'],
      prune: false,
      cacheControl: [s3deploy.CacheControl.fromString('public, max-age=31536000, immutable')],
      memoryLimit: 512,
    });
    const config = {
      apiUrl: props.graphqlUrl,
      authMode: 'cognito',
      lumiUrl: props.lumiUrl,
      cognito: { userPoolId: props.userPoolId, userPoolClientId: props.userPoolClientId },
    };
    const entry = new s3deploy.BucketDeployment(this, 'DeployEntry', {
      sources: [build, s3deploy.Source.jsonData('config.json', config)],
      destinationBucket: site,
      exclude: ['assets/*'],
      prune: false,
      cacheControl: [s3deploy.CacheControl.noCache()],
      distribution: this.distribution,
      distributionPaths: ['/*'],
      memoryLimit: 512,
    });
    entry.node.addDependency(assets);

    new CfnOutput(this, 'WebUrl', { value: `https://${this.distribution.distributionDomainName}` });
    this.addDemo(accessLogs);
    this.acknowledgeDeploymentHandler(site);

    Validations.of(this.distribution).acknowledge({ id: 'AwsSolutions-CFR1', reason: 'The demo is open to every country.' });
    Validations.of(this.distribution).acknowledge({ id: 'AwsSolutions-CFR2', reason: 'AWS WAF has a fixed monthly cost; it is left for after the MVP.' });
    Validations.of(this.distribution).acknowledge({ id: 'AwsSolutions-CFR4', reason: 'The MVP uses the cloudfront.net domain and its default certificate, whose TLS policy cannot be changed.' });
  }

  /**
   * The public demo: a bucket of its own, where the .lumia to show is copied by hand, served under `/demo-content/*`.
   * The page `/demo` reads the path from `demo.json`. Nothing else of the web changes.
   */
  private addDemo(accessLogs: s3.IBucket): void {
    const demoContent = new PrivateBucket(this, 'DemoContent', { kind: 'content', retain: false, accessLogs, logPrefix: 'demo-content/' });
    // A new copy of the file shows within a minute.
    const cache = new cloudfront.CachePolicy(this, 'DemoContentCache', { defaultTtl: Duration.minutes(1), minTtl: Duration.seconds(0), maxTtl: Duration.minutes(5) });
    this.distribution.addBehavior(`${DEMO_FILE_KEY.slice(0, DEMO_FILE_KEY.indexOf('/'))}/*`, origins.S3BucketOrigin.withOriginAccessControl(demoContent), {
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: cache,
      responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
    });
    new s3deploy.BucketDeployment(this, 'DeployDemoSettings', {
      sources: [s3deploy.Source.jsonData('demo.json', { file: `/${DEMO_FILE_KEY}` })],
      destinationBucket: this.siteBucket,
      prune: false,
      cacheControl: [s3deploy.CacheControl.noCache()],
      distribution: this.distribution,
      distributionPaths: ['/demo.json'],
      memoryLimit: 512,
    });
    new CfnOutput(this, 'DemoUrl', { value: `https://${this.distribution.distributionDomainName}/demo` });
    new CfnOutput(this, 'DemoBucketName', { value: demoContent.bucketName, description: 'Copy the .lumia of the demo here.' });
    new CfnOutput(this, 'DemoFileKey', { value: DEMO_FILE_KEY });
  }

  /** The function of aws-cdk-lib that copies the site to the bucket: its runtime and permissions are defined by CDK. */
  private acknowledgeDeploymentHandler(site: s3.Bucket): void {
    const handler = this.node.children.find((child) => child.node.id.startsWith('Custom::CDKBucketDeployment'));
    const bucket = site.node.defaultChild;
    if (handler === undefined || !(bucket instanceof s3.CfnBucket)) throw new Error('The site deployment handler was not found.');
    acknowledge(
      handler,
      'Function of aws-cdk-lib that copies the built site from the CDK assets bucket to the site bucket and invalidates CloudFront.',
      'AwsSolutions-L1',
      'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]',
      'AwsSolutions-IAM5[Action::s3:Abort*]',
      'AwsSolutions-IAM5[Action::s3:DeleteObject*]',
      'AwsSolutions-IAM5[Action::s3:GetBucket*]',
      'AwsSolutions-IAM5[Action::s3:GetObject*]',
      'AwsSolutions-IAM5[Action::s3:List*]',
      'AwsSolutions-IAM5[Resource::*]',
      `AwsSolutions-IAM5[Resource::${nagArn(bucket)}/*]`,
      `AwsSolutions-IAM5[Resource::${nagAssetsBucketObjects(this)}]`,
    );
  }
}
