import { DefaultStackSynthesizer, Stack, Token, Validations } from 'aws-cdk-lib';
import type { CfnResource } from 'aws-cdk-lib';
import type { IConstruct } from 'constructs';

/** `<LogicalId.Arn>`: how cdk-nag writes the ARN of a resource of the same stack in a finding. */
export function nagArn(resource: CfnResource): string {
  return `<${Stack.of(resource).getLogicalId(resource)}.Arn>`;
}

/** How cdk-nag writes a pseudo parameter or its value, when the stack knows it. */
function pseudo(value: string, name: string): string {
  return Token.isUnresolved(value) ? `<AWS::${name}>` : value;
}

/** The bootstrap bucket of the CDK assets of a stack, as cdk-nag writes it in a finding (`.../*`). */
export function nagAssetsBucketObjects(stack: Stack): string {
  const context: unknown = stack.node.tryGetContext('@aws-cdk/core:bootstrapQualifier');
  const qualifier = typeof context === 'string' ? context : DefaultStackSynthesizer.DEFAULT_QUALIFIER;
  return `arn:${pseudo(stack.partition, 'Partition')}:s3:::cdk-${qualifier}-assets-${pseudo(stack.account, 'AccountId')}-${pseudo(stack.region, 'Region')}/*`;
}

/** Acknowledges cdk-nag findings on a construct and its children, with the reason they are accepted. */
export function acknowledge(scope: IConstruct, reason: string, ...ids: string[]): void {
  for (const id of ids) Validations.of(scope).acknowledge({ id, reason });
}
