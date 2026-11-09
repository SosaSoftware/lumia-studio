# Architecture

Diagrams (do not embed; open by path): `docs/diagrams/aws-architecture.svg`, `docs/diagrams/lumi-message-flow.svg`, `docs/diagrams/lumi-change-flow.svg`, `docs/diagrams/deployment-stacks.svg`.

## Components

| Component | Code | In AWS | Locally (`sandbox/`) |
|---|---|---|---|
| Web editor | `apps/web` | S3 bucket `Site` + CloudFront | Vite dev server; proxies `/graphql`, `/dev/login`, `/storage`, `/lumi` (`apps/web/vite.config.ts`) |
| Studio API | `apps/api` | AppSync `lumia-studio`, one Lambda per handler family | `SandboxServer` with the same `FieldPipeline` and handlers (`sandbox/src/sandbox-server.ts`) |
| Database | `apps/api/db/migrations` | Aurora PostgreSQL Serverless v2 through the Data API | Postgres in Docker (`sandbox/docker-compose.yaml`) |
| Identity | `apps/api/src/lambda/pre-token-generation.ts` | Cognito user pool, client `Web` | `POST /dev/login`, HS256 dev JWT (`sandbox/src/auth/`) |
| Studio MCP | `apps/api/src/mcp` | Four Lambdas behind AgentCore Gateway `lumia-studio-tools` | `McpGatewayEmulator` (`sandbox/src/mcp-gateway/`) |
| Lumi | `apps/agent` | AgentCore Runtime `lumia_lumi` behind gateway `lumia-lumi-entry` | `npm run dev -w @lumia/agent` |
| Model, narration | — | Amazon Bedrock; Amazon Polly | Bedrock (needs AWS access); speech provider `none` |

## Stacks (`lib/studio-app.ts`, in creation order)

| Stack | Main resources | Receives |
|---|---|---|
| `LumiaStudioDataStack` | VPC without NAT, Aurora, secrets of `lumia_admin` and `studio_app`, `Migrate` trigger, buckets `Media`, `Published`, `AccessLogs`, managed access policies | deploy config |
| `LumiaStudioIdentityStack` | User pool, client `Web`, `PreTokenGeneration` | — |
| `LumiaStudioStack` | AppSync API, one resolver per `STUDIO_FIELDS` entry, Lambdas per handler, `Export` Lambda | data, identity |
| `LumiaStudioMcpStack` | One Lambda per `MCP_TARGETS` entry, env `STUDIO_GRAPHQL_URL` only | GraphQL URL |
| `LumiaStudioAgentStack` | MCP gateway and targets; entry gateway only with `LUMIA_LUMI_RUNTIME_ARN` | user pool, web client, MCP targets |
| `LumiaStudioAgentRuntimeStack` | Runtime from `apps/agent/Dockerfile`, bucket `Sessions`, Bedrock invoke permissions | MCP gateway URL |
| `LumiaStudioWebStack` | Bucket `Site`, CloudFront and `config.json` | GraphQL URL, Cognito ids, Lumi URL |

The entry gateway needs the runtime ARN and the web needs the entry URL, so a full deploy runs in three passes (`scripts/deploy-all.sh`).

## Flows

- **Editing.** `DocumentSession` (`apps/web/src/features/editor/document-session.ts`) saves through `StudioApi` with the bare token in `authorization`. AppSync runs `APPSYNC_RESOLVER_CODE` and invokes the Lambda of the field (`apps/api/src/lambda/appsync.ts`). `FieldPipeline.run` reads `sub` and `email` from the token, loads claims from the database (`ClaimsResolver`), authorizes with Cedar (`FieldAuthorizer`), then runs the handler → `FieldDispatcher` → command → service → repositories. Errors return as data `{ error: { type, message } }` and the resolver raises them. Editing a published version first creates a draft (`createVersion`).
- **Lumi turn.** `LumiSession.sendMessage` (`apps/web/src/features/lumi/lumi-session.ts`) flushes pending edits, locks the editor and runs up to 8 rounds (`MAX_ROUNDS`). Each run posts AG-UI input with `Authorization: Bearer <token>`, the session header, the screen tools and the screen context. `AguiServer` resolves the caller, `InputGuard` keeps only the new message and pending answers, `ThreadRegistry` lends the agent built by `LumiAgentFactory`. Studio tools go through the MCP gateway with the person's token; a screen tool call ends the run and the web answers in the next one. If a Studio tool changed the class, the web reloads it.
- **Change with consent.** Lumi calls `confirm_change`; the web shows a card and answers `{ confirmed }`. `ConfirmationGate` (`apps/agent/src/interventions/confirmation-gate.ts`) lets a write run only if an accepted change of the same turn has the same tool and arguments, once.
- **Publish and export.** `publishVersion` → `PublishService.publish` archives the previous published version, publishes the draft, marks the export `pending` and invokes `Export` asynchronously (`LambdaExportQueue`). `apps/api/src/lambda/export.ts` builds the `.lumia` zip (`apps/api/src/services/lumia-archive.ts`) and writes it to `Published`. The sandbox does not export (`NO_EXPORTS`). `scripts/publish-demo.sh` copies one published file to the demo bucket.
- **Narration.** `saveNarration` stores a clip as `pending`. `generateNarration` checks the voice against Polly, synthesizes, stores `narration/<documentId>/<clipId>.mp3` and `.marks.json` in `Media`, and marks the clip `ready` or `failed` (`apps/api/src/services/narration-service.ts`).
- **Media.** `createMediaUpload` returns a presigned PUT for `media/<categoryId>/<assetId>/<file>`; `registerMedia` records it (`apps/api/src/services/media-service.ts`).

## Cross-package contracts

| Contract | Defined in | Consumers |
|---|---|---|
| GraphQL schema and field registry | `apps/api/src/graphql/schema.graphql`, `apps/api/src/graphql/fields.ts` | web `apps/web/src/api/studio-api.ts`, MCP `apps/api/src/mcp/class-data.ts`, CDK `lib/stacks/lumia-studio-stack.ts`, sandbox |
| Cedar actions | `apps/api/src/auth/permissions.ts` | `apps/api/cedar/schema.cedarschema.json`, `apps/web/src/composables/app-context.ts`, `sandbox/seed/seed-data.ts` |
| Component catalog | `packages/src/catalog/index.ts` | API validation, web renderers and forms, MCP tools, export |
| MCP targets and tool schemas | `apps/api/src/mcp/targets.ts` | `lib/stacks/lumia-studio-mcp-stack.ts`, `lib/constructs/lumi/studio-mcp-gateway.ts`, emulator, `apps/agent/policies/confirmation.json` |
| Token header | `STUDIO_TOKEN_HEADER` in `apps/api/src/mcp/gateway-invocation.ts`; `DEFAULT_LUMI_MCP_TOKEN_HEADER` in `packages/src/lumi-env/index.ts` | gateway targets, runtime env, `StudioMcpConnector` |
| `confirm_change` | `apps/web/src/features/lumi/frontend-tools.ts`, `lumi-session.ts`, `apps/agent/src/interventions/confirmation-gate.ts` | Lumi prompt `apps/agent/src/prompts/lumi.md` |
| Lumi environment | `packages/src/lumi-env/index.ts` | `apps/agent/src/entrypoints/*.ts`, `lib/stacks/lumia-studio-agent-runtime-stack.ts`, `sandbox/scripts/dev.sh` |
| Web runtime config | `apps/web/src/config/app-config.ts` | `LumiaStudioWebStack`, `sandbox/scripts/dev.sh` |
| `.lumia` format | `apps/api/src/services/lumia-archive.ts` (`LUMIA_FORMAT_VERSION`) | `apps/api/src/lambda/export.ts` |
