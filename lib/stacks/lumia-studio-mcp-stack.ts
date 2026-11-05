import { Duration, Stack } from 'aws-cdk-lib';
import type { StackProps } from 'aws-cdk-lib';
import type * as lambda from 'aws-cdk-lib/aws-lambda';
import type { Construct } from 'constructs';
import { MCP_TARGETS, STUDIO_GRAPHQL_URL_ENV, toolSchemas } from '@lumia/api/mcp';
import type { GatewayToolSchema, McpTargetKey } from '@lumia/api/mcp';
import { StudioFunction } from '../constructs/studio-function';

export interface LumiaStudioMcpStackProps extends StackProps {
  /** GraphQL endpoint of the Studio API; the tools call it with the token of the person. */
  readonly graphqlUrl: string;
}

/** One Lambda target of the AgentCore Gateway of Lumi. */
export interface McpTargetResources {
  /** Target name; the gateway names the tools `<name>___<tool>`. */
  readonly name: string;
  readonly description: string;
  readonly fn: lambda.IFunction;
  /** Inline tool schema of the target. */
  readonly toolSchemas: readonly GatewayToolSchema[];
}

const HANDLERS: Readonly<Record<McpTargetKey, string>> = { read: 'readHandler', slides: 'slidesHandler', elements: 'elementsHandler', timeline: 'timelineHandler' };

/**
 * The Studio MCP: the tool Lambdas that Lumi reaches through its AgentCore Gateway. They have no AWS permissions:
 * each call goes to the Studio API with the token of the person, and Studio applies that person's permissions.
 * The Lumi stacks add the gateway targets and grant the gateway the invoke permission.
 */
export class LumiaStudioMcpStack extends Stack {
  public readonly targets: readonly McpTargetResources[];

  public constructor(scope: Construct, id: string, props: LumiaStudioMcpStackProps) {
    super(scope, id, props);
    this.targets = (Object.keys(MCP_TARGETS) as McpTargetKey[]).map((key) => {
      const target = MCP_TARGETS[key];
      const tool = new StudioFunction(this, `${key.charAt(0).toUpperCase()}${key.slice(1)}Tools`, {
        description: `Studio MCP tools: ${target.description}`,
        entry: 'apps/api/src/mcp/handlers/index.ts',
        handler: HANDLERS[key],
        timeout: Duration.seconds(30),
        environment: { [STUDIO_GRAPHQL_URL_ENV]: props.graphqlUrl },
      });
      return { name: target.name, description: target.description, fn: tool.fn, toolSchemas: toolSchemas(target) };
    });
  }
}
