import { App, Tags, Validations } from 'aws-cdk-lib';
import type { AppProps } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import type { DeployConfig } from './deploy-config';
import { LumiaStudioDataStack } from './stacks/lumia-studio-data-stack';
import { LumiaStudioIdentityStack } from './stacks/lumia-studio-identity-stack';
import { LumiaStudioAgentRuntimeStack } from './stacks/lumia-studio-agent-runtime-stack';
import { LumiaStudioAgentStack } from './stacks/lumia-studio-agent-stack';
import { LumiaStudioMcpStack } from './stacks/lumia-studio-mcp-stack';
import { LumiaStudioStack } from './stacks/lumia-studio-stack';
import { LumiaStudioWebStack } from './stacks/lumia-studio-web-stack';

/** The stacks of Lumia Studio, in deploy order. The Lumi stacks go between `mcp` and `web`. */
export interface StudioStacks {
  readonly app: App;
  readonly data: LumiaStudioDataStack;
  readonly identity: LumiaStudioIdentityStack;
  readonly studio: LumiaStudioStack;
  readonly mcp: LumiaStudioMcpStack;
  readonly lumi: LumiaStudioAgentStack;
  readonly lumiRuntime: LumiaStudioAgentRuntimeStack;
  readonly web: LumiaStudioWebStack;
}

/** Builds the Lumia Studio app with cdk-nag's AWS Solutions checks; any finding without an acknowledgment stops synth. */
export function createStudioApp(config: DeployConfig, props: AppProps = {}): StudioStacks {
  const app = new App(props);
  const env = config.env;
  const data = new LumiaStudioDataStack(app, 'LumiaStudioDataStack', { env, database: config.database });
  const identity = new LumiaStudioIdentityStack(app, 'LumiaStudioIdentityStack', { env });
  const studio = new LumiaStudioStack(app, 'LumiaStudioStack', { env, data, identity });
  const mcp = new LumiaStudioMcpStack(app, 'LumiaStudioMcpStack', { env, graphqlUrl: studio.api.graphqlUrl });
  // The gateways of Lumi: the MCP over Studio's tools, and the public entry once the other agent's runtime exists.
  const lumi = new LumiaStudioAgentStack(app, 'LumiaStudioAgentStack', {
    env,
    userPool: identity.userPool,
    webClient: identity.webClient,
    mcpTargets: mcp.targets,
    ...(config.lumiRuntimeArn === null ? {} : { runtimeArn: config.lumiRuntimeArn }),
  });
  // The runtime that runs Lumi (the agent image). It needs the MCP gateway URL, so it comes after the gateways stack.
  const lumiRuntime = new LumiaStudioAgentRuntimeStack(app, 'LumiaStudioAgentRuntimeStack', {
    env,
    gateways: lumi,
    userPool: identity.userPool,
    webClient: identity.webClient,
  });
  const web = new LumiaStudioWebStack(app, 'LumiaStudioWebStack', {
    env,
    graphqlUrl: studio.api.graphqlUrl,
    userPoolId: identity.userPool.userPoolId,
    userPoolClientId: identity.webClient.userPoolClientId,
    lumiUrl: config.lumiUrl ?? lumi.entryUrl ?? null,
  });
  Tags.of(app).add('project', 'lumia-studio');
  Validations.of(app).addPlugins(new AwsSolutionsChecks(app));
  return { app, data, identity, studio, mcp, lumi, lumiRuntime, web };
}
