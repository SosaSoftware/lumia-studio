# Add an MCP tool for Lumi

Adds a Studio tool that Lumi calls through the MCP gateway. Follow an existing tool in the same file as the pattern.

## Steps

1. Define the tool with `defineTool` in the matching file under `apps/api/src/mcp/tools/`. It calls the Studio API through `apps/api/src/mcp/studio-graphql.ts`, with the person's token.
2. Register it in its target in `apps/api/src/mcp/targets.ts` (`MCP_TARGETS`). Each target is one Lambda, wired in `apps/api/src/mcp/handlers/index.ts`.
3. Consent: tools of targets not listed in `readOnlyTargets` in `apps/agent/policies/confirmation.json` require `confirm_change`. Keep read-only tools in a read-only target.
4. If Lumi needs guidance to use it, update the prompt `apps/agent/src/prompts/lumi.md` or a skill in `apps/agent/skills/`.
5. The sandbox gateway emulator in `sandbox/src/mcp-gateway/` reads `MCP_TARGETS`, so it needs no change.

## Tests

Add tests next to the tool. `test/lumia-studio.test.ts` checks one gateway target per entry of `MCP_TARGETS`.

## Verify

`npm run typecheck`, `npm run lint`, `npm run test -w @lumia/api`, `npx jest` and `npm run synth`.

## Deploy

Tool schemas live in the gateway targets: the change needs `LumiaStudioMcpStack` and `LumiaStudioAgentStack` deployed. A person deploys; see `docs/operations/deployment.md`.

## Docs

Update `docs/architecture/lumi-tools.md`.
