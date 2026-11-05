import { Stack, Validations } from 'aws-cdk-lib';
import * as agentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/** Name of the target and its path segment in the invocation URL. */
const TARGET_NAME = 'lumi';

export interface LumiEntryGatewayProps {
  /** ARN of the AgentCore Runtime that runs Lumi; provided by the runtime stack. */
  readonly runtimeArn: string;
  /** Cognito user pool discovery URL of Lumia Studio. */
  readonly discoveryUrl: string;
  /** Web client id of Studio; tokens of other clients are rejected. */
  readonly allowedClientIds: readonly string[];
}

/**
 * The public entry to Lumi. It validates the person's access token against the Studio user pool and forwards it
 * unchanged (`JWT_PASSTHROUGH`) to the Runtime, which validates it again and reads the identity. The web uses the
 * invocation URL as `lumiUrl`.
 */
export class LumiEntryGateway extends Construct {
  public readonly gateway: agentcore.CfnGateway;
  public readonly role: iam.Role;
  /** Invocation endpoint of Lumi (the web's `LUMIA_LUMI_URL`). */
  public readonly invokeUrl: string;

  public constructor(scope: Construct, id: string, props: LumiEntryGatewayProps) {
    super(scope, id);
    const stack = Stack.of(this);

    this.role = new iam.Role(this, 'ServiceRole', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com', {
        conditions: {
          StringEquals: { 'aws:SourceAccount': stack.account },
          ArnLike: { 'aws:SourceArn': `arn:${stack.partition}:bedrock-agentcore:${stack.region}:${stack.account}:gateway/*` },
        },
      }),
      description: 'Role of the entry gateway of Lumi',
    });

    this.gateway = new agentcore.CfnGateway(this, 'Gateway', {
      name: 'lumia-lumi-entry',
      description: 'Public entry to Lumi',
      roleArn: this.role.roleArn,
      // No protocolType: a runtime target needs an HTTP gateway, which JWT_PASSTHROUGH requires.
      authorizerType: 'CUSTOM_JWT',
      authorizerConfiguration: { customJwtAuthorizer: { discoveryUrl: props.discoveryUrl, allowedClients: [...props.allowedClientIds] } },
      exceptionLevel: 'DEBUG',
    });

    const target = new agentcore.CfnGatewayTarget(this, 'RuntimeTarget', {
      name: TARGET_NAME,
      description: 'The AgentCore Runtime that runs Lumi',
      gatewayIdentifier: this.gateway.attrGatewayIdentifier,
      targetConfiguration: { http: { agentcoreRuntime: { arn: props.runtimeArn, qualifier: 'DEFAULT' } } },
      // Forwards the person's token unchanged, so the Runtime sees the original caller.
      credentialProviderConfigurations: [{ credentialProviderType: 'JWT_PASSTHROUGH' }],
    });
    target.addResourceDependency(this.gateway);
    // The bundled CloudFormation schema of this CDK release does not yet model the HTTP AgentCore Runtime target,
    // although the service accepts it; the template matches AWS's own reference. Acknowledged on this resource only.
    Validations.of(target).acknowledge({ id: 'CloudFormation-Validate::F3018', reason: 'HTTP AgentCore Runtime target is valid at AWS; the local schema of this CDK release does not model it yet.' });

    this.invokeUrl = `https://${this.gateway.attrGatewayIdentifier}.gateway.bedrock-agentcore.${stack.region}.amazonaws.com/${TARGET_NAME}/invocations`;
  }
}
