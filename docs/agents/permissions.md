# Permission guidance

A recommended permission policy for AI assistants in this repository. It is guidance: each developer decides which permissions, hooks and blocks to configure in their own tool. Setup only offers it; see [setup.md](setup.md#6-offer-the-permission-guidance).

## Recommended policy

| Level | Actions | Examples |
|---|---|---|
| Allow | Read the repository; edit files in the working tree; run local checks | `npm run typecheck`, `npm run lint`, `npm run test`, `npm run synth`, `git status`, `git diff`, `git log` |
| Allow, with AWS credentials | Read-only comparisons against an AWS account | `npx cdk diff --no-change-set` |
| Ask first | Effects outside the working tree | `cdk deploy`, `cdk destroy`, `scripts/deploy-all.sh`, AWS commands that create, change or delete resources, database writes through RDS Data API, `git push`, history rewrites, dependency changes, installing tools, plugins or MCP servers |
| Avoid | Exposing secrets | Reading or printing `.env` and `.env.*` values, printing credentials or tokens |

## Why

- Deployments change shared environments, and some changes are destructive. [`docs/operations/deployment.md`](../operations/deployment.md) lists the known risks, such as removing the Lumi entry gateway.
- Database writes in AWS change the content and access of real people. See [`docs/operations/content.md`](../operations/content.md).
- The repository is public, so a secret written to a file is exposed once pushed.
