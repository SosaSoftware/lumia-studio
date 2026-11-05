import { Match, Template } from 'aws-cdk-lib/assertions';
import { STUDIO_FIELDS } from '@lumia/api/deployment';
import { MCP_TARGETS } from '@lumia/api/mcp';
import { readDeployConfig } from '../lib/deploy-config';
import { createStudioApp } from '../lib/studio-app';
import type { StudioStacks } from '../lib/studio-app';

// Bundling is skipped: the tests check the templates, `npm run synth` builds the functions and the web.
const TEST_ENV = { CDK_DEFAULT_ACCOUNT: '123456789012', CDK_DEFAULT_REGION: 'us-east-1' };

function build(env: Record<string, string> = {}): StudioStacks {
  return createStudioApp(readDeployConfig({ ...TEST_ENV, ...env }), { context: { 'aws:cdk:bundling-stacks': [] } });
}

describe('Lumia Studio app', () => {
  const stacks = build();
  const template = {
    data: Template.fromStack(stacks.data),
    identity: Template.fromStack(stacks.identity),
    studio: Template.fromStack(stacks.studio),
    mcp: Template.fromStack(stacks.mcp),
    lumi: Template.fromStack(stacks.lumi),
    web: Template.fromStack(stacks.web),
  };

  it('synthesizes with the AWS Solutions checks of cdk-nag and no finding left', () => {
    expect(() => build().app.synth()).not.toThrow();
  });

  it('keeps Aurora Serverless v2 between 0 and 1 ACU with the Data API, pausing after 5 minutes', () => {
    template.data.hasResourceProperties('AWS::RDS::DBCluster', {
      Engine: 'aurora-postgresql',
      EnableHttpEndpoint: true,
      StorageEncrypted: true,
      DeletionProtection: true,
      ServerlessV2ScalingConfiguration: { MinCapacity: 0, MaxCapacity: 1, SecondsUntilAutoPause: 300 },
    });
    template.data.hasResource('AWS::RDS::DBCluster', { DeletionPolicy: 'Snapshot' });
    template.data.resourceCountIs('AWS::EC2::NatGateway', 0);
    template.data.hasResourceProperties('Custom::Trigger', { ExecuteOnHandlerChange: true });
    const capacity = Template.fromStack(build({ LUMIA_DB_MIN_ACU: '0.5', LUMIA_DB_MAX_ACU: '2' }).data);
    capacity.hasResourceProperties('AWS::RDS::DBCluster', { ServerlessV2ScalingConfiguration: { MinCapacity: 0.5, MaxCapacity: 2, SecondsUntilAutoPause: Match.absent() } });
  });

  it('keeps media and published classes in private, retained buckets; published ones versioned', () => {
    template.data.hasResource('AWS::S3::Bucket', {
      DeletionPolicy: 'Retain',
      Properties: Match.objectLike({
        VersioningConfiguration: { Status: 'Enabled' },
        PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
        BucketEncryption: { ServerSideEncryptionConfiguration: [{ ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } }] },
      }),
    });
    template.data.hasResourceProperties('AWS::S3::Bucket', { CorsConfiguration: { CorsRules: [Match.objectLike({ AllowedMethods: ['PUT', 'GET', 'HEAD'] })] } });
  });

  it('creates accounts only by an administrator, with the email added to the access token', () => {
    template.identity.hasResourceProperties('AWS::Cognito::UserPool', {
      AdminCreateUserConfig: Match.objectLike({ AllowAdminCreateUserOnly: true }),
      UserPoolTier: 'ESSENTIALS',
      Policies: { PasswordPolicy: Match.objectLike({ MinimumLength: 12, RequireSymbols: true }) },
      LambdaConfig: { PreTokenGenerationConfig: { LambdaVersion: 'V2_0', LambdaArn: Match.anyValue() } },
    });
    template.identity.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      GenerateSecret: false,
      ExplicitAuthFlows: ['ALLOW_USER_SRP_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
      AllowedOAuthFlowsUserPoolClient: false,
    });
  });

  it('serves the schema on AppSync with Cognito and one JavaScript resolver per field', () => {
    template.studio.hasResourceProperties('AWS::AppSync::GraphQLApi', { AuthenticationType: 'AMAZON_COGNITO_USER_POOLS', IntrospectionConfig: 'DISABLED', XrayEnabled: true });
    template.studio.resourceCountIs('AWS::AppSync::Resolver', STUDIO_FIELDS.length);
    template.studio.allResourcesProperties('AWS::AppSync::Resolver', { Runtime: { Name: 'APPSYNC_JS', RuntimeVersion: '1.0.0' } });
    // Five resolvers and the export; the other function is the log retention helper of aws-cdk-lib.
    const studioFunctions = template.studio.findResources('AWS::Lambda::Function', { Properties: { Environment: { Variables: Match.objectLike({ NODE_OPTIONS: '--enable-source-maps' }) } } });
    expect(Object.keys(studioFunctions)).toHaveLength(6);
    for (const fn of Object.values(studioFunctions)) {
      expect(fn.Properties).toMatchObject({ Runtime: 'nodejs24.x', Architectures: ['arm64'], TracingConfig: { Mode: 'Active' } });
    }
  });

  it('gives Polly only to narration and the invoke of the export only to publishing', () => {
    const policies = template.studio.findResources('AWS::IAM::Policy');
    const withAction = (action: string): string[] =>
      Object.entries(policies)
        .filter(([, policy]) => JSON.stringify(policy).includes(`"${action}"`))
        .map(([name]) => name);
    expect(withAction('polly:SynthesizeSpeech')).toEqual([expect.stringMatching(/^NarrationResolver/)]);
    expect(withAction('lambda:InvokeFunction').filter((name) => name.includes('Resolver'))).toEqual([expect.stringMatching(/^PublishResolver/)]);
  });

  it('exposes the four MCP targets with their tools; the functions only know the API URL', () => {
    expect(stacks.mcp.targets.map((target) => target.name)).toEqual(Object.values(MCP_TARGETS).map((target) => target.name));
    expect(stacks.mcp.targets.flatMap((target) => target.toolSchemas)).toHaveLength(23);
    template.mcp.resourceCountIs('AWS::Lambda::Function', 4);
    template.mcp.allResourcesProperties('AWS::Lambda::Function', { Environment: { Variables: Match.objectLike({ STUDIO_GRAPHQL_URL: Match.anyValue() }) } });
    template.mcp.resourcePropertiesCountIs('AWS::IAM::Policy', { PolicyDocument: { Statement: Match.arrayWith([Match.objectLike({ Action: Match.stringLikeRegexp('^(s3|rds-data|secretsmanager):') })]) } }, 0);
  });

  it('serves the public demo from its own bucket under /demo-content, with the file path in demo.json', () => {
    template.web.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        CacheBehaviors: [Match.objectLike({ PathPattern: 'demo-content/*', ViewerProtocolPolicy: 'redirect-to-https' })],
      }),
    });
    // Site, demo content and logs.
    template.web.resourceCountIs('AWS::S3::Bucket', 3);
    template.web.resourceCountIs('AWS::CloudFront::OriginAccessControl', 2);
    template.web.hasResourceProperties('Custom::CDKBucketDeployment', { DistributionPaths: ['/demo.json'] });
    template.web.hasOutput('DemoFileKey', { Value: 'demo-content/demo.lumia' });
  });

  it('exposes an IAM MCP gateway for Lumi over the four tool Lambdas, propagating the person token header', () => {
    template.lumi.hasResourceProperties('AWS::BedrockAgentCore::Gateway', { ProtocolType: 'MCP', AuthorizerType: 'AWS_IAM' });
    template.lumi.resourceCountIs('AWS::BedrockAgentCore::GatewayTarget', Object.keys(MCP_TARGETS).length);
    template.lumi.allResourcesProperties('AWS::BedrockAgentCore::GatewayTarget', {
      CredentialProviderConfigurations: [{ CredentialProviderType: 'GATEWAY_IAM_ROLE' }],
      MetadataConfiguration: { AllowedRequestHeaders: ['X-Amzn-Bedrock-AgentCore-Runtime-Custom-StudioToken'] },
    });
    // No entry gateway without a runtime ARN; the MCP gateway can deploy before Lumi's runtime exists.
    expect(stacks.lumi.entryUrl).toBeUndefined();
  });

  it('adds the public entry gateway, forwarding the token to the runtime, only with a runtime ARN', () => {
    const withRuntime = build({ LUMIA_LUMI_RUNTIME_ARN: 'arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/lumi_agent-a1b2c3d4e5' });
    const lumi = Template.fromStack(withRuntime.lumi);
    // The MCP gateway plus the entry gateway.
    lumi.resourceCountIs('AWS::BedrockAgentCore::Gateway', 2);
    lumi.hasResourceProperties('AWS::BedrockAgentCore::GatewayTarget', {
      TargetConfiguration: { Http: { AgentcoreRuntime: Match.objectLike({ Qualifier: 'DEFAULT' }) } },
      CredentialProviderConfigurations: [{ CredentialProviderType: 'JWT_PASSTHROUGH' }],
    });
    expect(withRuntime.lumi.entryUrl).toMatch(/\/lumi\/invocations$/);
  });

  it('runs Lumi on an AGUI AgentCore runtime with the MCP URL and token header, no KB or memory', () => {
    const rt = Template.fromStack(stacks.lumiRuntime);
    rt.hasResourceProperties('AWS::BedrockAgentCore::Runtime', {
      ProtocolConfiguration: 'AGUI',
      EnvironmentVariables: Match.objectLike({
        LUMI_MCP_TOKEN_HEADER: 'X-Amzn-Bedrock-AgentCore-Runtime-Custom-StudioToken',
        LUMI_MCP_URL: Match.anyValue(),
        LUMI_SESSION_BUCKET: Match.anyValue(),
      }),
      AuthorizerConfiguration: { CustomJWTAuthorizer: Match.objectLike({ AllowedClients: Match.anyValue() }) },
    });
    // No memory resource for the MVP.
    rt.resourceCountIs('AWS::BedrockAgentCore::Memory', 0);
    // The runtime role can invoke the MCP gateway and the model.
    const policies = JSON.stringify(rt.findResources('AWS::IAM::Policy'));
    expect(policies).toContain('bedrock-agentcore:InvokeGateway');
    expect(policies).toContain('bedrock:InvokeModel');
  });

  it('serves the web from a private bucket through CloudFront, HTTPS only, with logs', () => {
    template.web.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultRootObject: 'index.html',
        DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: 'redirect-to-https' }),
        Logging: Match.objectLike({ Prefix: 'cloudfront/' }),
      }),
    });
    template.web.hasResourceProperties('Custom::CDKBucketDeployment', { DistributionPaths: ['/*'] });
  });
});
