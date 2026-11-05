import { CfnOutput, Duration, Stack } from 'aws-cdk-lib';
import type { StackProps } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';
import { APPSYNC_RESOLVER_CODE, STUDIO_FIELDS } from '@lumia/api/deployment';
import { StudioFunction } from '../constructs/studio-function';
import type { BundledFile } from '../constructs/studio-function';
import { acknowledge, nagArn } from '../nag';
import type { LumiaStudioDataStack } from './lumia-studio-data-stack';
import type { LumiaStudioIdentityStack } from './lumia-studio-identity-stack';

export interface LumiaStudioStackProps extends StackProps {
  readonly data: LumiaStudioDataStack;
  readonly identity: LumiaStudioIdentityStack;
}

/** Each resolver Lambda reads cedar-wasm's WebAssembly next to its bundle. */
const CEDAR_WASM: BundledFile = { from: 'node_modules/@cedar-policy/cedar-wasm/nodejs/cedar_wasm_bg.wasm', to: 'cedar_wasm_bg.wasm' };

function pascal(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function cfnFunction(fn: lambda.Function): lambda.CfnFunction {
  const resource = fn.node.defaultChild;
  if (!(resource instanceof lambda.CfnFunction)) throw new Error(`${fn.node.path} has no CfnFunction`);
  return resource;
}

/**
 * The Studio API: AppSync with the schema of `@lumia/api` and Cognito sign-in, one resolver per field of
 * `STUDIO_FIELDS` on the Lambda of its handler, and the function that exports published classes as .lumia files.
 */
export class LumiaStudioStack extends Stack {
  public readonly api: appsync.GraphqlApi;

  public constructor(scope: Construct, id: string, props: LumiaStudioStackProps) {
    super(scope, id, props);
    const { data, identity } = props;
    this.api = new appsync.GraphqlApi(this, 'Api', {
      name: 'lumia-studio',
      definition: appsync.Definition.fromFile(require.resolve('@lumia/api/schema.graphql')),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          // Only tokens of the web client; Lumi forwards the same token of the person.
          userPoolConfig: { userPool: identity.userPool, appIdClientRegex: `^${identity.webClient.userPoolClientId}$`, defaultAction: appsync.UserPoolDefaultAction.ALLOW },
        },
      },
      // Errors only, without request headers: verbose content would write the token of the person to the logs.
      logConfig: { fieldLogLevel: appsync.FieldLogLevel.ERROR, excludeVerboseContent: true, retention: logs.RetentionDays.ONE_MONTH },
      xrayEnabled: true,
      introspectionConfig: appsync.IntrospectionConfig.DISABLED,
      queryDepthLimit: 10,
    });

    acknowledge(this.api, 'Errors are logged without verbose content, which would include the token of the person.', 'AwsSolutions-ASC3');
    acknowledge(this.api, 'AppSync writes its logs with the AWS managed policy made for it.', 'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSAppSyncPushToCloudWatchLogs]');

    const environment: Record<string, string> = {
      LUMIA_DB_DRIVER: 'data-api',
      LUMIA_DB_CLUSTER_ARN: data.cluster.clusterArn,
      LUMIA_DB_SECRET_ARN: data.appSecret.secretArn,
      LUMIA_DB_NAME: data.databaseName,
      LUMIA_STORAGE_DRIVER: 's3',
      LUMIA_MEDIA_BUCKET: data.mediaBucket.bucketName,
    };

    const exporter = new StudioFunction(this, 'Export', {
      description: 'Exports a published class as a .lumia file to the published bucket.',
      entry: 'apps/api/src/lambda/export.ts',
      handler: 'handler',
      // The .lumia file is built in memory with every medium of the class.
      memorySize: 3008,
      timeout: Duration.minutes(5),
      environment: { ...environment, LUMIA_PUBLISHED_BUCKET: data.publishedBucket.bucketName },
    });
    data.grant(exporter.role, 'database', 'mediaRead', 'publishedWrite');
    exporter.fn.configureAsyncInvoke({ retryAttempts: 2, maxEventAge: Duration.hours(1) });

    const handlers = [...new Set(STUDIO_FIELDS.map((field) => field.handler))];
    const dataSources = new Map<string, appsync.LambdaDataSource>();
    for (const name of handlers) {
      const resolver = new StudioFunction(this, `${pascal(name)}Resolver`, {
        description: `Resolves the ${name} fields of the Studio API.`,
        entry: 'apps/api/src/lambda/appsync.ts',
        handler: name,
        memorySize: 1024,
        // AppSync waits 30 seconds; a paused database takes about 15 to resume.
        timeout: Duration.seconds(30),
        environment: {
          ...environment,
          ...(name === 'narration' ? { LUMIA_SPEECH_PROVIDER: 'polly' } : {}),
          ...(name === 'publish' ? { LUMIA_EXPORT_FUNCTION: exporter.fn.functionName } : {}),
        },
        files: [CEDAR_WASM],
      });
      // Signed download URLs need read access; uploads and narration audio also write.
      data.grant(resolver.role, 'database');
      if (name !== 'tree') data.grant(resolver.role, 'mediaRead');
      if (name === 'media') data.grant(resolver.role, 'mediaUpload');
      if (name === 'narration') {
        data.grant(resolver.role, 'narrationAudio');
        resolver.fn.addToRolePolicy(new iam.PolicyStatement({ actions: ['polly:DescribeVoices', 'polly:SynthesizeSpeech'], resources: ['*'] }));
      }
      // Publishing starts the export without a qualifier, so the plain ARN is enough.
      if (name === 'publish') resolver.fn.addToRolePolicy(new iam.PolicyStatement({ actions: ['lambda:InvokeFunction'], resources: [exporter.fn.functionArn] }));
      const dataSource = this.api.addLambdaDataSource(`${pascal(name)}Source`, resolver.fn, { description: `Lambda of the ${name} fields.` });
      acknowledge(dataSource, 'AppSync may invoke the versions of the function (ARN with a qualifier).', `AwsSolutions-IAM5[Resource::${nagArn(cfnFunction(resolver.fn))}:*]`);
      dataSources.set(name, dataSource);
    }

    for (const field of STUDIO_FIELDS) {
      const dataSource = dataSources.get(field.handler);
      if (dataSource === undefined) throw new Error(`No data source for ${field.type}.${field.field}`);
      dataSource.createResolver(`${field.type}${pascal(field.field)}`, {
        typeName: field.type,
        fieldName: field.field,
        runtime: appsync.FunctionRuntime.JS_1_0_0,
        code: appsync.Code.fromInline(APPSYNC_RESOLVER_CODE),
      });
    }

    new CfnOutput(this, 'GraphqlUrl', { value: this.api.graphqlUrl });

    // AppSync sets the retention of its log group with this function of aws-cdk-lib.
    const logRetention = this.node.children.find((child) => child.node.id.startsWith('LogRetention'));
    if (logRetention === undefined) throw new Error('The log retention function of AppSync was not found.');
    acknowledge(
      logRetention,
      'Function of aws-cdk-lib that sets the retention of the AppSync log group; CDK defines its permissions.',
      'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]',
      'AwsSolutions-IAM5[Resource::*]',
    );
  }
}
