# Lumi

## Overview

Lumi is the co-creation agent of Lumia Studio. It is built with the Strands TypeScript SDK and its harness (`createHarness`), and serves AG-UI over SSE, the same way locally and in Amazon Bedrock AgentCore Runtime.

- **Reactive.** Lumi acts only on what the person asks. It does not suggest, review or act on its own.
- **Studio through its MCP.** Lumi reaches the Studio tools through AgentCore Gateway with the person's own token, so Studio applies that person's permissions to every call. The token travels in `Authorization` and in `X-Amzn-Bedrock-AgentCore-Runtime-Custom-StudioToken`, which the gateway propagates to the tool Lambdas; the model never sees it. Lumi shows the model only the Studio tools that `get_my_access` lists for the person.
- **Consent for every change.** A change to a class runs only after the person accepts it with the screen tool `confirm_change`, in the same turn and with the same arguments, once. The `ConfirmationGate` intervention enforces this on the server.
- **State per person.** Conversations (S3, or a directory locally) and preferences (AgentCore Memory, or a directory locally) are kept under a hash of the `sub` of the token. Another person sending the same thread id gets a new, empty conversation.
- **The server owns the conversation.** From each AG-UI request, Lumi keeps only the new message of the person and the answers to the screen tools it is waiting for. The history that AG-UI clients resend is ignored.

A request goes through these steps:

```
browser (AG-UI HttpAgent)
  └─ POST /invocations ── token → person ── RunAgentInput validation ── agent of (person, thread) ── input guard
       └─ @ag-ui/aws-strands ── Strands agent (harness) ──┬─ Amazon Bedrock (Claude Sonnet 4.6)
                                                         └─ Studio MCP through AgentCore Gateway
```

## Requirements

- Node.js 22.13 or later and npm, from the repository workspace.
- The sandbox for local runs: Docker and `npm run sandbox:init` (see the repository README).
- Access to Claude Sonnet 4.6 on Amazon Bedrock (`us.anthropic.claude-sonnet-4-6`) in `AWS_REGION`, with AWS credentials or a Bedrock API key in `BEDROCK_API_KEY`. Keep the key in the environment of the shell, never in `.env`.
- Docker with Buildx to build the image.

## Setup

```bash
npm install
npm run sandbox:init   # Postgres, migrations and demo seed; creates .env from .env.example
```

The Lumi variables are in the Lumi block of `.env.example`. An `.env` created before that block existed still works: `sandbox/scripts/dev.sh` supplies the local defaults.

## Usage

`npm run dev:up` starts the local services: `api` (:4000), `web` (:5173), `mcp` (:4100, a stand-in for the AgentCore Gateway of Lumi, in `sandbox/src/mcp-gateway`) and `lumi` (:8080). The web reaches Lumi at `/lumi/invocations` through the Vite proxy. To run only Lumi, with reload on change: `npm run dev -w @lumia/agent`.

| Command | What it runs |
|---|---|
| `npm test -w @lumia/agent` | Unit tests. Hermetic, part of `npm run verify`. |
| `npm run test:integration -w @lumia/agent` | Lumi against a local Studio (sandbox API and gateway stand-in, in-process) on the sandbox Postgres, with a scripted model. |
| `npm run test:functional -w @lumia/agent` | Lumi with its real model on Bedrock, driven like the web, against a local Studio with content of its own. Costs model tokens; outside `verify`. |
| `npm run build -w @lumia/agent` | Bundles `dist/remote.mjs` with esbuild. |

HTTP contract:

| Route | Contract |
|---|---|
| `POST /invocations` | AG-UI `RunAgentInput` as JSON, with `Authorization: Bearer <token>`. Streams AG-UI events as SSE, or as protobuf when `Accept` asks for `application/vnd.ag-ui.event+proto`. |
| `GET /ping` | `{"status":"Healthy"}`, or `HealthyBusy` while a turn runs. |

Errors before the stream starts are JSON `{ "error": { "code", "message" } }`: 400 for an invalid input or thread id, 401 for a missing, invalid or rejected token, 413 for a body or message too large, 415 for a body that is not JSON, and 503 when Studio cannot be reached. A turn that fails once streaming ends with `RUN_ERROR`: the browser gets the code and a generic message, and the error text, which can name AWS accounts or roles, stays in the log. The next message still works: a turn left without a reply is closed before it.

`confirm_change` is a screen tool of the web. Lumi calls it with `{ message, changes: [{ action, summary, arguments, targets? }] }`, one change per tool call it will run, and the web answers `{ "confirmed": true | false }`, or `{ "confirmed": false, "error": "..." }` when it could not ask.

## Configuration

The variables are validated at start-up by `@lumia/packages/lumi-env`, which also names them for the infrastructure. Empty values count as unset.

| Variable | Default | Meaning |
|---|---|---|
| `AWS_REGION` | required | Region of Bedrock, S3 and AgentCore Memory. |
| `LUMI_MCP_URL` | required | MCP endpoint: the AgentCore Gateway URL, or `http://localhost:4100/mcp` locally. |
| `LUMI_MCP_TOKEN_HEADER` | `X-Amzn-Bedrock-AgentCore-Runtime-Custom-StudioToken` | Header that carries the token of the person to the tools. |
| `LUMI_SESSION_BUCKET`, `LUMI_SESSION_PREFIX` | none, `sessions` | Conversations in S3. Set this or `LUMI_SESSION_DIR`. |
| `LUMI_SESSION_DIR` | none | Conversations in a directory (local). |
| `LUMI_MEMORY_ID` | none | Preferences in AgentCore Memory. Set this or `LUMI_MEMORY_DIR`. |
| `LUMI_MEMORY_DIR` | none | Preferences in a directory (local). |
| `LUMI_MODEL_ID` | `us.anthropic.claude-sonnet-4-6` | Bedrock model or inference profile. |
| `LUMI_MODEL_TEMPERATURE` | `0.2` | Sampling temperature; `none` leaves the model default. |
| `LUMI_MODEL_MAX_TOKENS` | `16384` | Output limit per model call. |
| `LUMI_GUARDRAIL_ID`, `LUMI_GUARDRAIL_VERSION` | none | Bedrock guardrail; set both or neither. |
| `BEDROCK_API_KEY` | none | Bedrock API key; without it, the AWS credential chain applies. |
| `LUMI_PORT`, `LUMI_BIND_HOST` | `8080`, `127.0.0.1` | Listening address; the image sets `0.0.0.0`. |
| `LUMI_THREAD_IDLE_MINUTES` | `30` | Minutes before an idle conversation leaves memory; it stays in storage. |
| `LUMI_LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error`. Logs are JSON lines. |
| `LUMIA_DEV_JWT_SECRET` | none | Secret of the sandbox tokens; only the local entry point uses it. |

Files that define Lumi, read once at start-up (an invalid file stops it):

| Path | Content |
|---|---|
| `src/prompts/lumi.md` | Instructions, added after the harness contract. |
| `src/prompts/preference-extraction.md` | What counts as a lasting preference (local memory). |
| `skills/<name>/SKILL.md` | Co-creation skills, loaded on demand. The `name` in the front matter must match the folder. |
| `policies/confirmation.json` | Consent rules: the confirmation tool, the gateway targets that only read (every other target needs consent) and the most changes per confirmation. |

## Project structure

```
apps/agent/
├── Dockerfile                 arm64 image for AgentCore Runtime, built from the repository root
├── policies/confirmation.json consent rules
├── scripts/build.ts           esbuild bundle of the AgentCore entry point
├── skills/                    co-creation skills (SKILL.md per folder)
├── src/
│   ├── entrypoints/           local.ts (sandbox tokens, directories) and remote.ts (AgentCore)
│   ├── identity/              token → person: sandbox token verifier and AgentCore token reader
│   ├── interventions/         ConfirmationGate and its policy, the ledger of pending screen calls, the closer of unfinished turns
│   ├── mcp/                   Studio MCP connection with the person's token, filtered by get_my_access
│   ├── memory/                preferences: AgentCore Memory or files
│   ├── model/                 Bedrock model
│   ├── prompts/               instructions and the preference extraction prompt
│   ├── server/                AG-UI server, input guard, screen context and registry of conversations
│   ├── shared/                JSON logger
│   ├── storage/               conversations per person, and the hashed keys of people and threads
│   ├── lumi.agent.ts          Lumi, built with createHarness for each conversation
│   ├── lumi-assets.ts         loads prompts, skills and policy
│   └── lumi-runtime.ts        wires everything from the settings and serves it
└── test/                      integration and functional tests, and their support
```

## Deployment

Build the image from the repository root:

```bash
docker buildx build --platform linux/arm64 -f apps/agent/Dockerfile -t lumi .
```

The image holds the bundle, the prompts, the skills and the policy, with no `node_modules`. It runs as the `node` user, listens on 8080 and has a `HEALTHCHECK` on `/ping`.

The infrastructure of Lumi (not part of this package yet) has to provide:

- **AgentCore Runtime** with the AG-UI protocol, the image and the variables above (`LUMI_SESSION_BUCKET` and `LUMI_MEMORY_ID` instead of directories). Its inbound JWT authorizer validates the Cognito tokens of Studio, and `Authorization` must be in the request header allowlist so it reaches the container.
- **The role of the runtime**, allowed to call `bedrock:InvokeModelWithResponseStream` on the inference profile and its models, `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` and `s3:ListBucket` on the session bucket and prefix, and `bedrock-agentcore:CreateEvent` and `bedrock-agentcore:RetrieveMemoryRecords` on the memory.
- **AgentCore Memory** with a user preference strategy whose namespace is `/users/{actorId}/preferences`.
- **AgentCore Gateway** with the Studio MCP targets, an inbound JWT authorizer for the same Cognito, and `X-Amzn-Bedrock-AgentCore-Runtime-Custom-StudioToken` in `metadataConfiguration.allowedRequestHeaders` of each target.

The web sends `X-Amzn-Bedrock-AgentCore-Runtime-Session-Id` with its thread id, so each conversation stays on one runtime session. Traces turn on with `OTEL_TRACES_EXPORTER=otlp` (the harness sets up the Strands tracer).
