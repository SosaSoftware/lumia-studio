import { Stack } from 'aws-cdk-lib';
import * as agentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import * as iam from 'aws-cdk-lib/aws-iam';
import type * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { STUDIO_TOKEN_HEADER } from '@lumia/api/mcp';
import type { GatewaySchema, GatewayToolSchema } from '@lumia/api/mcp';

/** One MCP target: the tool Lambda and its inline tool schema. */
export interface StudioMcpTarget {
  /** Target name; the gateway names the tools `<name>___<tool>`. */
  readonly name: string;
  readonly description: string;
  readonly fn: lambda.IFunction;
  readonly toolSchemas: readonly GatewayToolSchema[];
}

export interface StudioMcpGatewayProps {
  readonly targets: readonly StudioMcpTarget[];
}

/** The input schema of a tool, as the gateway L1 takes it. */
function toSchemaDefinition(schema: GatewaySchema): agentcore.CfnGatewayTarget.SchemaDefinitionProperty {
  return {
    type: schema.type,
    ...(schema.description === undefined ? {} : { description: schema.description }),
    ...(schema.properties === undefined ? {} : { properties: Object.fromEntries(Object.entries(schema.properties).map(([name, child]) => [name, toSchemaDefinition(child)])) }),
    ...(schema.required === undefined ? {} : { required: [...schema.required] }),
    ...(schema.items === undefined ? {} : { items: toSchemaDefinition(schema.items) }),
  };
}

function toolDefinition(tool: GatewayToolSchema): agentcore.CfnGatewayTarget.ToolDefinitionProperty {
  return { name: tool.name, description: tool.description, inputSchema: toSchemaDefinition(tool.inputSchema) };
}

/**
 * The internal AgentCore Gateway that exposes the Studio MCP tools to Lumi. Its inbound auth is AWS_IAM: the Lumi
 * runtime calls it signing with its own role. The runtime passes the person's token in the `STUDIO_TOKEN_HEADER`,
 * which the gateway propagates to the tool Lambdas, and each tool calls the Studio API with it, so Studio applies
 * the person's permissions. The tools come from `LumiaStudioMcpStack`. The public, per-person auth is at the entry
 * gateway, not here.
 */
export class StudioMcpGateway extends Construct {
  public readonly gateway: agentcore.CfnGateway;
  public readonly role: iam.Role;
  /** ARN of the gateway; the Lumi runtime needs `bedrock-agentcore:InvokeGateway` on it. */
  public readonly gatewayArn: string;
  /** MCP endpoint Lumi connects to. */
  public readonly url: string;

  public constructor(scope: Construct, id: string, props: StudioMcpGatewayProps) {
    super(scope, id);
    const stack = Stack.of(this);

    this.role = new iam.Role(this, 'ServiceRole', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com', {
        conditions: {
          StringEquals: { 'aws:SourceAccount': stack.account },
          ArnLike: { 'aws:SourceArn': `arn:${stack.partition}:bedrock-agentcore:${stack.region}:${stack.account}:gateway/*` },
        },
      }),
      description: 'Role of the Studio MCP gateway of Lumi',
    });

    this.gateway = new agentcore.CfnGateway(this, 'Gateway', {
      name: 'lumia-studio-mcp',
      description: 'Studio MCP tools for Lumi; the runtime calls it signing with its role',
      roleArn: this.role.roleArn,
      protocolType: 'MCP',
      // The caller is the Lumi runtime, which signs with its role; there is no identity provider to consult.
      authorizerType: 'AWS_IAM',
      exceptionLevel: 'DEBUG',
    });
    this.gatewayArn = this.gateway.attrGatewayArn;

    for (const target of props.targets) {
      const resource = new agentcore.CfnGatewayTarget(this, `${target.name}-target`, {
        name: target.name,
        description: target.description,
        gatewayIdentifier: this.gateway.attrGatewayIdentifier,
        targetConfiguration: {
          mcp: { lambda: { lambdaArn: target.fn.functionArn, toolSchema: { inlinePayload: target.toolSchemas.map(toolDefinition) } } },
        },
        // The gateway invokes the tool Lambda with its own role.
        credentialProviderConfigurations: [{ credentialProviderType: 'GATEWAY_IAM_ROLE' }],
        // The gateway propagates the token header to the tool Lambda.
        metadataConfiguration: { allowedRequestHeaders: [STUDIO_TOKEN_HEADER] },
      });
      resource.addResourceDependency(this.gateway);
      // Invoke the exact function (no :* version wildcard), so there is no IAM5 wildcard to acknowledge.
      this.role.addToPrincipalPolicy(new iam.PolicyStatement({ actions: ['lambda:InvokeFunction'], resources: [target.fn.functionArn] }));
    }

    this.url = `https://${this.gateway.attrGatewayIdentifier}.gateway.bedrock-agentcore.${stack.region}.amazonaws.com/mcp`;
  }

  /** Lets a principal (the Lumi runtime) invoke this gateway. */
  public grantInvoke(grantee: iam.IGrantable): void {
    grantee.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({ actions: ['bedrock-agentcore:InvokeGateway'], resources: [this.gatewayArn] }));
  }
}
