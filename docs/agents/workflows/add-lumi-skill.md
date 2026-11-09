# Add or change a Lumi skill

Changes how Lumi carries out a kind of task. Follow an existing skill as the pattern.

## Steps

1. Create or edit `apps/agent/skills/<name>/SKILL.md`, with front matter `name` and `description`. The description says when Lumi should use the skill.
2. Write the steps with the exact tool names, such as `studio-slides___add_slides`, and include asking for consent with `confirm_change` before any change.
3. For behavior that applies to every turn, edit `apps/agent/src/prompts/lumi.md` instead.
4. `apps/agent/src/lumi-assets.ts` loads prompts, skills and the consent policy from the package root. The image copies `apps/agent/skills` (see `apps/agent/Dockerfile`), so a new skill needs no other wiring.

## Tests

`apps/agent/src/lumi-assets.test.ts` checks that the assets load.

## Verify

`npm run test -w @lumia/agent` and `npm run build -w @lumia/agent`.

## Deploy

Skills ship in the agent image: the change needs `LumiaStudioAgentRuntimeStack` deployed. A person deploys; see `docs/operations/deployment.md`.

## Docs

Update `docs/architecture/lumi-tools.md`.
