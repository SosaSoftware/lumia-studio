import { App, Tags, Validations } from 'aws-cdk-lib';
import type { AppProps } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import type { DeployConfig } from './deploy-config';
import { LumiaStudioDataStack } from './stacks/lumia-studio-data-stack';
import { LumiaStudioIdentityStack } from './stacks/lumia-studio-identity-stack';
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
  const web = new LumiaStudioWebStack(app, 'LumiaStudioWebStack', {
    env,
    graphqlUrl: studio.api.graphqlUrl,
    userPoolId: identity.userPool.userPoolId,
    userPoolClientId: identity.webClient.userPoolClientId,
    lumiUrl: config.lumiUrl,
  });
  Tags.of(app).add('project', 'lumia-studio');
  Validations.of(app).addPlugins(new AwsSolutionsChecks(app));
  return { app, data, identity, studio, mcp, web };
}
