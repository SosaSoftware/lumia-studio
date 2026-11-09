# Invariants

Rules the code relies on. Check the ones that touch the files you change before finishing.

| Invariant | Defined in | Test |
|---|---|---|
| Every Studio operation runs through the field registry and is authorized with Cedar before its handler runs | `apps/api/src/graphql/fields.ts` (`STUDIO_FIELDS`), `apps/api/src/runtime/field-pipeline.ts`, `apps/api/src/auth/permissions.ts` (`ACTIONS`) | `apps/api/src/graphql/fields.test.ts` |
| The person's Cognito access token travels unchanged from the web to Studio: web → entry gateway → runtime → MCP gateway → tool Lambda → AppSync | `lib/constructs/lumi/lumi-entry-gateway.ts`, `lib/stacks/lumia-studio-agent-runtime-stack.ts`, `apps/agent/src/mcp/studio-mcp-connector.ts`, `apps/api/src/mcp/studio-graphql.ts` | `test/lumia-studio.test.ts` |
| Tool Lambdas receive the token in the header `X-Amzn-Bedrock-AgentCore-Runtime-Custom-StudioToken`, allowlisted on every MCP target | `apps/api/src/mcp/gateway-invocation.ts` (`STUDIO_TOKEN_HEADER`), `lib/constructs/lumi/studio-mcp-gateway.ts` | `test/lumia-studio.test.ts` |
| Gateways and runtime accept only tokens of the Studio web client, checked with `allowedClients` (the access token has no `aud`) | `lib/constructs/lumi/`, `lib/stacks/lumia-studio-agent-runtime-stack.ts` | `test/lumia-studio.test.ts` |
| Tool Lambdas have no AWS permissions; they act only through the Studio API with the person's token | `lib/stacks/lumia-studio-mcp-stack.ts` | No test |
| A write through an MCP tool runs only after `confirm_change` was accepted in the same turn with the same arguments | `apps/agent/src/interventions/confirmation-gate.ts`, `apps/agent/policies/confirmation.json` | `apps/agent/src/interventions/confirmation-gate.test.ts` |
| `confirm_change` has the same shape in the web and in the agent: `{ message, changes: [{ action, summary, arguments, targets? }] }` | `apps/web/src/features/lumi/frontend-tools.ts`, `apps/web/src/features/lumi/lumi-session.ts`, `apps/agent/src/interventions/confirmation-gate.ts` | `apps/web/src/features/lumi/lumi-session.test.ts`, `apps/agent/src/interventions/confirmation-gate.test.ts` |
| The authorizer type of an existing AgentCore Gateway cannot change; changing it needs a new construct id and gateway name | `lib/constructs/lumi/studio-mcp-gateway.ts` | No test |
| `LumiaStudioAgentStack` creates the entry gateway only when `LUMIA_LUMI_RUNTIME_ARN` is set; deploying it without the variable removes the gateway | `lib/stacks/lumia-studio-agent-stack.ts`, `lib/deploy-config.ts` | `test/lumia-studio.test.ts` |
| The agent bundle resolves ES builds first (`mainFields: ['module', 'main']`); without it, named exports of dynamically imported CommonJS packages are undefined | `apps/agent/scripts/build.ts` | No test |
| Migrations are append-only and run in order, locally with `npm run db:migrate` and in AWS on every deploy of `LumiaStudioDataStack` | `apps/api/db/migrations/`, `lib/stacks/lumia-studio-data-stack.ts` | Integration tests |
| A cdk-nag finding without an acknowledgment stops synthesis | `lib/studio-app.ts` | `npm run synth` |
| `SlideLayoutEngine` shrinks boxes to fit the slide, but component content scales with width; too many components on one slide overflow visually | `packages/src/catalog/layout/slide-layout-engine.ts` | `packages/src/catalog/catalog.test.ts` (no box overlap only) |
