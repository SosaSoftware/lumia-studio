/** Single source of truth for a GraphQL field: the local server uses it now, the CDK stack later. */
export interface FieldDefinition {
  type: 'Query' | 'Mutation';
  field: string;
  /** Cedar action, or null when the field only requires an identity. */
  action: string | null;
  handler: string;
  /** Present when the field operates on a record: its type and the argument holding its id. */
  resource?: { type: string; idArg: string };
}
