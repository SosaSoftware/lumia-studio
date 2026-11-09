# Change infrastructure

Changes the AWS CDK app: stacks, constructs, permissions or deployment settings.

## Where

| What | File |
|---|---|
| Stack order and wiring | `lib/studio-app.ts` |
| Stacks | `lib/stacks/` |
| Reusable constructs | `lib/constructs/` |
| Deployment settings read from the environment | `lib/deploy-config.ts` |
| Tests | `test/lumia-studio.test.ts`, `test/deploy-config.test.ts` |

## Steps

1. Make the change following the existing stack's pattern.
2. Acknowledge each new cdk-nag finding next to the resource, with `Validations.of(...).acknowledge` and a reason. Synthesis fails without it.
3. Check [knowledge/invariants.md](../knowledge/invariants.md): the gateway authorizer type and the entry gateway variable are the common traps.
4. Update the tests in `test/`.

## Verify

`npx jest` and `npm run synth`. Against an account, a person or an approved assistant runs `npx cdk diff <stack> --exclusively --no-change-set`, with `LUMIA_LUMI_RUNTIME_ARN` and `LUMIA_LUMI_URL` set.

## Deploy

A person deploys, following `docs/operations/deployment.md`.

## Docs

Update `docs/operations/deployment.md`, `docs/architecture/README.md` and the affected diagrams in `docs/diagrams/`.
