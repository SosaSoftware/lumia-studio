# Verification

What to run before finishing a change. Scripts are defined in the root `package.json` and in each workspace's `package.json`.

| Change | Run |
|---|---|
| Any TypeScript or Vue file | `npm run typecheck`, `npm run lint` |
| Code in one workspace | `npm run test -w @lumia/<api\|agent\|web\|packages\|sandbox>` |
| Infrastructure (`bin/`, `lib/`) | `npx jest`, `npm run synth` |
| Database access, migrations or the sandbox | `npm run test:integration`, after `npm run sandbox:init` |
| Agent runtime or its bundle | `npm run test -w @lumia/agent`, `npm run build -w @lumia/agent` |
| Before a commit, broad changes | `npm run verify`: typecheck, lint, all unit tests and synth |

## Requirements

| Check | Needs |
|---|---|
| Integration tests | Docker with the sandbox database: `npm run sandbox:init` |
| Local services | `npm run dev:up`, see `docs/development/setup.md` |
| `npx cdk diff` | AWS credentials, and `LUMIA_LUMI_RUNTIME_ARN` and `LUMIA_LUMI_URL` for the Lumi stacks. See `docs/operations/deployment.md` |

## Not verifiable locally

- Behavior of AWS services: AgentCore gateways and runtime, AppSync, Cognito. Compare with `npx cdk diff <stack> --exclusively --no-change-set`; deployment is done by a person.
- `npm run test:e2e`: Playwright looks for tests in `apps/web/e2e`, which does not exist.

## Documentation changes

Check that every link and relative path in the changed files resolves, and that every command and environment variable mentioned exists in the repository.
