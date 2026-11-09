# Repository map

npm monorepo with workspaces `apps/*`, `packages` and `sandbox`, plus an AWS CDK app at the root (`package.json`). Workspaces are ESM TypeScript and import with the `.ts` extension (`tsconfig.base.json`). The CDK app (`bin`, `lib`, `test`) uses the root `tsconfig.json` and imports without extension.

## Folders and packages

| Path | Package | Purpose | Entry points and key files | Used by |
|---|---|---|---|---|
| `apps/api` | `@lumia/api` | GraphQL API, Cedar authorization, services, repositories, migrations, Studio MCP tools | `src/graphql/schema.graphql`, `src/graphql/fields.ts` (`STUDIO_FIELDS`), `src/handlers/<family>/`, `src/lambda/*.ts`, `src/mcp/handlers/index.ts`, `src/auth/permissions.ts`, `db/migrations/` | `sandbox`; CDK app through the subpaths in `apps/api/package.json` `exports` |
| `apps/web` | `@lumia/web` | Vue 3 + Vite editor and Lumi panel | `src/main.ts`, `src/router/index.ts`, `src/pages/`, `src/features/<feature>/`, `src/features/lumi/lumi-session.ts`, `src/features/lumi/frontend-tools.ts`, `vite.config.ts` | Built by `lib/stacks/lumia-studio-web-stack.ts` |
| `apps/agent` | `@lumia/agent` | Lumi, served over AG-UI | `src/entrypoints/local.ts`, `src/entrypoints/remote.ts`, `src/lumi-runtime.ts`, `src/lumi.agent.ts`, `src/prompts/`, `skills/`, `policies/confirmation.json`, `scripts/build.ts`, `Dockerfile` | Image built by `lib/stacks/lumia-studio-agent-runtime-stack.ts` |
| `packages` | `@lumia/packages` | Component catalog and Lumi environment contract | `src/catalog/index.ts`, `src/lumi-env/index.ts` | `api`, `web`, `agent`, `sandbox` |
| `sandbox` | `@lumia/sandbox` | Local replacement of Aurora, AppSync, Cognito, S3 and the MCP gateway; seed data | `scripts/sandbox.sh`, `scripts/dev.sh`, `src/main.ts`, `src/mcp-gateway/main.ts`, `seed/seed.ts`, `seed/seed-data.ts`, `seed/showcase.ts`, `docker-compose.yaml` | `agent` tests via `@lumia/sandbox/testing` |
| `bin`, `lib` | — | CDK app: seven stacks with cdk-nag | `bin/lumia-studio.ts`, `lib/studio-app.ts`, `lib/deploy-config.ts`, `lib/stacks/`, `lib/constructs/`, `lib/nag.ts` | `cdk.json` |
| `test` | — | Jest tests of the CDK templates and the deploy settings | `test/lumia-studio.test.ts`, `test/deploy-config.test.ts` | `npm test` |
| `scripts` | — | Deploy helpers that a person runs with AWS credentials | `scripts/deploy-all.sh` | — |
| `docs` | — | Human documentation (Spanish), SVG diagrams, this kit | `docs/README.md`, `docs/diagrams/`, `docs/agents/` | — |

Root files: `package.json` (scripts), `eslint.config.mjs`, `jest.config.js`, `cdk.json` (app: `npx tsc && npx tsx bin/lumia-studio.ts`), `cdk.context.json` (versioned, see `.gitignore`).

Not versioned (`.gitignore`): `node_modules`, `cdk.out`, `dist`, `.env`, `.sandbox/` (local database files, storage, logs, Lumi sessions), `apps/web/public/config.json` (written by `sandbox/scripts/dev.sh`).

## Dependencies between packages

- `@lumia/packages` depends on no workspace.
- `@lumia/api`, `@lumia/web` and `@lumia/agent` depend on `@lumia/packages`.
- `@lumia/sandbox` depends on `@lumia/api` and `@lumia/packages`. `@lumia/agent` uses it only in tests (devDependency).
- Lumi runtime code imports only `@lumia/packages` from the workspace: the Docker build stage copies only `packages/src` and `apps/agent` (`apps/agent/Dockerfile`).
- The CDK app imports `@lumia/api/{config,deployment,mcp,schema.graphql}` and bundles `apps/api/src/lambda/*.ts` and `apps/api/src/mcp/handlers/index.ts` with esbuild (`lib/constructs/studio-function.ts`).

## Where a change belongs

| Change | Location | Workflow |
|---|---|---|
| GraphQL field, business rule, Cedar action | `apps/api` | [add-graphql-field](../workflows/add-graphql-field.md) |
| Table or column | `apps/api/db/migrations`, `apps/api/src/repositories` | [add-migration](../workflows/add-migration.md) |
| Slide component | `packages/src/catalog`, `apps/web/src/features/slide-components` | [add-catalog-component](../workflows/add-catalog-component.md) |
| Tool for Lumi | `apps/api/src/mcp/tools` | [add-mcp-tool](../workflows/add-mcp-tool.md) |
| Lumi instructions, skills, consent policy | `apps/agent/src/prompts`, `apps/agent/skills`, `apps/agent/policies` | [add-lumi-skill](../workflows/add-lumi-skill.md) |
| Screen tool or Lumi panel | `apps/web/src/features/lumi` | — |
| Editor interface | `apps/web/src/features/<feature>` | — |
| AWS resource, permission, deploy setting, Lumi env var | `lib`, `test`, `packages/src/lumi-env` | [change-infrastructure](../workflows/change-infrastructure.md) |
| Local environment or seed data | `sandbox` | — |
| Human docs or diagrams | `docs/` | [update-docs-and-diagrams](../workflows/update-docs-and-diagrams.md) |
