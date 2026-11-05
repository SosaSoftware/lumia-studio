/** Identity of the caller as AppSync delivers it to a direct Lambda resolver. */
export interface AppSyncIdentity {
  sub: string;
  claims: Readonly<Record<string, unknown>>;
  resolverContext?: Readonly<Record<string, unknown>>;
}

/** Event of an AppSync direct Lambda resolver. */
export interface AppSyncResolverEvent<TArgs = Record<string, unknown>> {
  arguments: TArgs;
  identity: AppSyncIdentity | null;
  source: Readonly<Record<string, unknown>> | null;
  info: { fieldName: string; parentTypeName: string };
  request: { headers: Readonly<Record<string, string>> };
}
