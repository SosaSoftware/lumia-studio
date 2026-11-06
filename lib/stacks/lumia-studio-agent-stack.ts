import { CfnOutput, Stack } from 'aws-cdk-lib';
import type { StackProps } from 'aws-cdk-lib';
import type * as cognito from 'aws-cdk-lib/aws-cognito';
import type { Construct } from 'constructs';
import { LumiEntryGateway } from '../constructs/lumi/lumi-entry-gateway';
import { StudioMcpGateway } from '../constructs/lumi/studio-mcp-gateway';
import type { StudioMcpTarget } from '../constructs/lumi/studio-mcp-gateway';

export interface LumiaStudioAgentStackProps extends StackProps {
  /** Studio user pool, to validate the person's token at both gateways. */
  readonly userPool: cognito.IUserPool;
  /** Web client of Studio; the same client that issues the token Lumi forwards. */
  readonly webClient: cognito.IUserPoolClient;
  /** The MCP tool Lambdas and their schemas, from LumiaStudioMcpStack. */
  readonly mcpTargets: readonly StudioMcpTarget[];
  /**
   * ARN of the AgentCore Runtime that runs Lumi; the other agent's runtime stack provides it. Without it only the
   * MCP gateway is created, so the tools can be deployed before the runtime exists.
   */
  readonly runtimeArn?: string;
}

/**
 * The gateways of Lumi: the AgentCore Gateway over the Studio MCP tools (with the token interceptor) and, when the
 * runtime exists, the public entry gateway. Both validate the person's Studio token. The agent's runtime and memory
 * live in the other agent's stacks.
 */
export class LumiaStudioAgentStack extends Stack {
  public readonly mcpGatewayUrl: string;
  /** Invocation endpoint for the web's LUMIA_LUMI_URL; set only when the runtime ARN is given. */
  public readonly entryUrl: string | undefined;

  public constructor(scope: Construct, id: string, props: LumiaStudioAgentStackProps) {
    super(scope, id, props);
    const allowedClientIds = [props.webClient.userPoolClientId];
    const discoveryUrl = `https://cognito-idp.${this.region}.amazonaws.com/${props.userPool.userPoolId}/.well-known/openid-configuration`;

    const mcp = new StudioMcpGateway(this, 'StudioTools', { targets: props.mcpTargets, discoveryUrl, allowedClientIds });
    this.mcpGatewayUrl = mcp.url;
    new CfnOutput(this, 'McpGatewayUrl', { value: mcp.url, description: 'MCP endpoint Lumi connects to with the token of the person.' });
    new CfnOutput(this, 'McpGatewayArn', { value: mcp.gatewayArn, description: 'ARN of the Studio MCP gateway.' });

    if (props.runtimeArn !== undefined) {
      const entry = new LumiEntryGateway(this, 'Entry', { runtimeArn: props.runtimeArn, discoveryUrl, allowedClientIds });
      this.entryUrl = entry.invokeUrl;
      new CfnOutput(this, 'LumiUrl', { value: entry.invokeUrl, description: 'Set LUMIA_LUMI_URL to this and redeploy the web.' });
    }
  }
}
