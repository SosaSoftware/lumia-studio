import { CfnOutput, Duration, Stack, Token, Validations } from 'aws-cdk-lib';
import type { StackProps } from 'aws-cdk-lib';
import * as agentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import type * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import type * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';
import { STUDIO_TOKEN_HEADER } from '@lumia/api/mcp';
import { PrivateBucket } from '../constructs/private-bucket';
import { repoPath } from '../paths';
import type { LumiaStudioAgentStack } from './lumia-studio-agent-stack';

export interface LumiaStudioAgentRuntimeStackProps extends StackProps {
  /** The gateways stack: the MCP URL Lumi calls. */
  readonly gateways: LumiaStudioAgentStack;
  /** Studio user pool, to validate the person's token at the runtime (the entry gateway already did once). */
  readonly userPool: cognito.IUserPool;
  readonly webClient: cognito.IUserPoolClient;
  /** Logs for the sessions bucket access logs. */
  readonly accessLogs?: s3.IBucket;
}

/** Idle time a runtime session is kept, so turns of one conversation reuse the instance and avoid cold starts. */
const IDLE_SESSION_TIMEOUT = Duration.hours(2);

/**
 * The AgentCore Runtime that runs Lumi, built from `apps/agent`. Lumi reaches the Studio tools through the MCP
 * gateway, forwarding the person's token in `Authorization` and in `STUDIO_TOKEN_HEADER`. Conversations are kept in an
 * S3 bucket. No knowledge base or long-term memory for the MVP: Lumi co-creates from its prompt and skills, which live
 * in the agent image.
 */
export class LumiaStudioAgentRuntimeStack extends Stack {
  public readonly runtime: agentcore.Runtime;
  public readonly runtimeArn: string;

  public constructor(scope: Construct, id: string, props: LumiaStudioAgentRuntimeStackProps) {
    super(scope, id, props);
    const discoveryUrl = `https://cognito-idp.${this.region}.amazonaws.com/${props.userPool.userPoolId}/.well-known/openid-configuration`;

    const sessions = new PrivateBucket(this, 'Sessions', {
      kind: 'content',
      retain: false,
      accessLogs: props.accessLogs ?? new PrivateBucket(this, 'SessionsLogs', { kind: 'logs', retain: false, expireAfterDays: 30 }),
      logPrefix: 'sessions/',
    });

    this.runtime = new agentcore.Runtime(this, 'Runtime', {
      runtimeName: 'lumia_lumi',
      description: 'Lumi, the co-creation harness of Lumia Studio',
      agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromAsset(repoPath('.'), { file: 'apps/agent/Dockerfile', platform: Platform.LINUX_ARM64 }),
      protocolConfiguration: agentcore.ProtocolType.AGUI,
      networkConfiguration: agentcore.RuntimeNetworkConfiguration.usingPublicNetwork(),
      lifecycleConfiguration: { idleRuntimeSessionTimeout: IDLE_SESSION_TIMEOUT },
      // The entry gateway forwards the person's Authorization; the runtime validates it again and reads the identity.
      requestHeaderConfiguration: { allowlistedHeaders: ['Authorization'] },
      // Validate the person's Cognito access token by client id (the token carries no audience). The runtime must use
      // JWT so it can forward the Authorization header to the agent, which decodes the token to read the identity.
      authorizerConfiguration: agentcore.RuntimeAuthorizerConfiguration.usingJWT(discoveryUrl, [props.webClient.userPoolClientId]),
      // tracingEnabled needs an account-level X-Ray setting; application logs in CloudWatch do not.
      tracingEnabled: false,
      environmentVariables: {
        AWS_REGION: this.region,
        LUMI_ENV: 'remote',
        LUMI_PORT: '8080',
        LUMI_BIND_HOST: '0.0.0.0',
        LUMI_MCP_URL: props.gateways.mcpGatewayUrl,
        LUMI_MCP_TOKEN_HEADER: STUDIO_TOKEN_HEADER,
        LUMI_SESSION_BUCKET: sessions.bucketName,
        // No AgentCore long-term memory for the MVP; preferences live in the container's writable storage.
        LUMI_MEMORY_DIR: '/tmp/lumi-memory',
      },
    });
    this.runtimeArn = this.runtime.agentRuntimeArn;

    // Lumi keeps conversations in the bucket; Bedrock runs the model.
    sessions.grantReadWrite(this.runtime.grantPrincipal);
    this.runtime.grantPrincipal.addToPrincipalPolicy(
      new iam.PolicyStatement({
        sid: 'InvokeModel',
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        // The us.* inference profiles spread inference across several regions, so the resource is a wildcard.
        resources: [`arn:${this.partition}:bedrock:*::foundation-model/*`, `arn:${this.partition}:bedrock:*:${this.account}:inference-profile/*`],
      }),
    );

    new CfnOutput(this, 'RuntimeArn', { value: this.runtimeArn, description: 'Set LUMIA_LUMI_RUNTIME_ARN to this and redeploy the agent stack to create the entry gateway.' });

    this.acknowledgeNag();
  }

  /** cdk-nag findings on resources whose shape is set by the AgentCore Runtime L2 or by the AWS session model. */
  private acknowledgeNag(): void {
    const role = this.runtime.role;
    // cdk-nag prints these ARNs with the partition resolved to `aws` and the account as a literal; build them the
    // same way. The deployment pins the account and region in .env, so they are literals here.
    const account = Token.isUnresolved(this.account) ? '<AWS::AccountId>' : this.account;
    const partition = Token.isUnresolved(this.partition) ? '<AWS::Partition>' : this.partition;
    const logBase = `arn:${partition}:logs:${this.region}:${account}:log-group:`;
    const logIds = [
      `AwsSolutions-IAM5[Resource::${logBase}*]`,
      `AwsSolutions-IAM5[Resource::${logBase}/aws/bedrock-agentcore/runtimes/*]`,
      `AwsSolutions-IAM5[Resource::${logBase}/aws/bedrock-agentcore/runtimes/*:log-stream:*]`,
    ];
    for (const id of logIds) Validations.of(role).acknowledge({ id, reason: 'The AgentCore Runtime execution role (created by the L2) writes to its own per-runtime log groups and streams.' });
    Validations.of(role).acknowledge({ id: 'AwsSolutions-IAM5[Resource::*]', reason: 'X-Ray and the AgentCore workload identity only take "*" as resource.' });
    Validations.of(role).acknowledge({
      id: `AwsSolutions-IAM5[Resource::arn:${partition}:bedrock-agentcore:${this.region}:${account}:workload-identity-directory/default/workload-identity/*]`,
      reason: 'The runtime manages its own workload identity, set by the AgentCore Runtime L2.',
    });
    for (const action of ['Abort', 'DeleteObject', 'GetBucket', 'GetObject', 'List']) {
      Validations.of(role).acknowledge({ id: `AwsSolutions-IAM5[Action::s3:${action}*]`, reason: 'Read and write the conversation objects of the sessions bucket.' });
    }
    Validations.of(role).acknowledge({ id: 'AwsSolutions-IAM5[Resource::<Sessions8896A56D.Arn>/*]', reason: 'Conversations are written under the sessions bucket, one object per session.' });
    Validations.of(role).acknowledge({ id: `AwsSolutions-IAM5[Resource::arn:${partition}:bedrock:*::foundation-model/*]`, reason: 'The us.* inference profiles spread inference across several regions, so the model resource is a wildcard.' });
    Validations.of(role).acknowledge({ id: `AwsSolutions-IAM5[Resource::arn:${partition}:bedrock:*:${account}:inference-profile/*]`, reason: 'The model is chosen at runtime from the Bedrock inference profiles.' });
    Validations.of(this.runtime).acknowledge({ id: 'aws-cdk-lib.aws-bedrockagentcore:containerUriValidationSkipped', reason: 'The image is built from the agent Dockerfile as a CDK asset, so its URI is only known at synth.' });
  }
}
