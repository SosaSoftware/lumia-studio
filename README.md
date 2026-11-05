# Lumia Studio

Content editor for interactive classes. Content lives in a tree: **category → subcategory → folders → classes** (`.lumia` leaves that hold the slides). Lumia Studio has its own data, users, roles and permissions, and its own AWS infrastructure.

## Layout

| Path | Package | What it holds |
|---|---|---|
| `apps/api` | `@lumia/api` | GraphQL schema, field registry with the Cedar action of each field, AppSync Lambda handlers, services, repositories, database migrations (`db/migrations`) and the Cedar schema (`cedar/`). |
| `apps/web` | `@lumia/web` | Vue 3 editor: explorer tree, slide canvas, properties, timeline, comments, media library and preview. |
| `apps/agent` | `@lumia/agent` | Lumi, the agent harness of Studio (integrated later). |
| `packages` | `@lumia/packages` | Code shared by the apps; today the component catalog (`@lumia/packages/catalog`). |
| `sandbox` | `@lumia/sandbox` | Local environment: Postgres in Docker, a local server in place of AppSync, Cognito and S3, and the demo seed. |
| `bin`, `lib`, `test` | — | AWS CDK app and its tests. |

## Requirements

- Node.js 22 and npm.
- Docker (Docker Desktop on macOS).

## Quick start

```bash
npm install
npm run sandbox:init   # starts Postgres, applies the migrations and loads the demo seed
npm run dev:up         # local API on :4000 and the web editor on :5173
```

Open <http://localhost:5173> and sign in with any account below. The sandbox login only checks that the email belongs to an active account; the password is not checked.

| Email | Role | Access |
|---|---|---|
| `creadora@studio.test` | Creación de contenido | Academia Lumia (all its subcategories) |
| `matematicas@studio.test` | Creación de contenido | Academia Lumia › Matemáticas only |
| `lectora@studio.test` | Lectura | Academia Lumia, read only |
| `admin@studio.test` | Administración | Both categories |
| `sin-acceso@studio.test` | — | No role: the sign-in shows that the account has no access |

The class *Fundamentos › ¿Qué es la inteligencia artificial?* comes with eight slides that use every component of the catalog. The other classes start empty.

The tree, people, roles and grants are managed in the database (`studio.category`, `studio.subcategory`, `studio.tree_node`, `studio.app_user`, `studio.role`, `studio.role_permission`, `studio.access_grant`). The editor only edits the content of existing classes.

## Scripts

| Command | What it does |
|---|---|
| `npm run verify` | Type check, lint, unit tests and `cdk synth`. |
| `npm run test:integration` | API and sandbox tests against the sandbox Postgres. |
| `npm run sandbox:up` / `sandbox:down` / `sandbox:reset` | Starts, stops or empties the sandbox database. |
| `npm run db:migrate` / `db:seed` | Applies the migrations / loads the demo data (both can run again safely). |
| `npm run dev:up` / `dev:down` / `dev:status` / `dev:logs <api\|web>` | Local services in the background; logs in `.sandbox/`. |

`.env` is created by `npm run sandbox:up` from `.env.example` with random secrets and is never committed.

## AWS

`npm run deploy` (`cdk deploy --all`) builds the functions and the web and deploys five stacks in this order. The first deploy in an account needs `npx cdk bootstrap`.

| Stack | What it holds |
|---|---|
| `LumiaStudioDataStack` | Aurora PostgreSQL Serverless v2 with the Data API (pauses when idle; migrations run on each deploy), the media library and the published classes (`.lumia` files). |
| `LumiaStudioIdentityStack` | Cognito user pool (accounts created by an administrator) and the web client. |
| `LumiaStudioStack` | AppSync API with one Lambda per handler, and the export of published classes. |
| `LumiaStudioMcpStack` | The Lambdas of the Studio MCP that Lumi uses through its AgentCore Gateway. |
| `LumiaStudioWebStack` | The web on S3 behind CloudFront, with its `config.json`. |

The settings of a deployment are in `.env` (last block of `.env.example`). Synth runs the AWS Solutions checks of cdk-nag; a finding without an acknowledgment stops it. Deleting a stack keeps the data: the database leaves a snapshot, and the user pool and the data buckets stay.

