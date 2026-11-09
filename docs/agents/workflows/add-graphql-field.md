# Add a GraphQL field

Adds a query or mutation to the Studio API. Follow an existing field of the same handler as the pattern.

## Steps

1. Declare the field and its types in `apps/api/src/graphql/schema.graphql`.
2. Register it in `STUDIO_FIELDS` in `apps/api/src/graphql/fields.ts`, with its Cedar action and its handler.
3. If it needs a new action, add it to `ACTIONS` in `apps/api/src/auth/permissions.ts`, regenerate `apps/api/cedar/schema.cedarschema.json` with `npm run cedar:schema -w @lumia/api`, and grant it to the roles that need it (`sandbox/seed/seed-data.ts` for the sandbox; see `docs/operations/content.md` for AWS).
4. Implement the logic in the handler's service and repository under `apps/api/src/services/` and `apps/api/src/repositories/`. Handlers are listed in `apps/api/src/handlers/index.ts` and exported for AppSync in `apps/api/src/lambda/appsync.ts`. `LumiaStudioStack` creates one Lambda per handler from `STUDIO_FIELDS`.
5. If the web uses it, add the call to `apps/web/src/api/studio-api.ts`.
6. If Lumi should use it, follow [add-mcp-tool.md](add-mcp-tool.md).

## Tests

Update `apps/api/src/graphql/fields.test.ts` and add tests next to the service you changed.

## Verify

`npm run typecheck`, `npm run lint`, `npm run test -w @lumia/api`, `npm run test:integration` and `npm run synth`.

## Docs

Update `docs/architecture/api.md` and, if a new action exists, `docs/architecture/authentication.md`.
