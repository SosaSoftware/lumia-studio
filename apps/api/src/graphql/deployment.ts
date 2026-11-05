/**
 * What the CDK needs to deploy the API on AppSync, without loading the handlers: the fields with the Lambda that
 * resolves each one, and the resolver code they share. The schema file is exported as `@lumia/api/schema.graphql`.
 */
export { STUDIO_FIELDS } from './fields.ts';
export { APPSYNC_RESOLVER_CODE } from './appsync/resolver-code.ts';
export type { FieldDefinition } from './appsync/field-registry.ts';
