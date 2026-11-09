# Add a database migration

Changes the `studio` schema in Aurora PostgreSQL.

## Steps

1. Add a new file in `apps/api/db/migrations/` with the next number, for example `0008_<name>.sql`. Never edit a migration that already exists: they are applied in order and only once.
2. Separate statements with `--;`, as the existing migrations do.
3. Update the repositories in `apps/api/src/repositories/` that read or write the changed tables.
4. Update the sandbox seed in `sandbox/seed/seed-data.ts` if it inserts into the changed tables.

## Apply

- Locally: `npm run db:migrate`. To start over: `npm run sandbox:reset`, then `npm run sandbox:init`.
- In AWS: the migrations run on every deploy of `LumiaStudioDataStack`. A person deploys.

## Verify

`npm run test:integration` with the sandbox running, plus `npm run test -w @lumia/api` and `npm run test -w @lumia/sandbox`.

## Docs

Update `docs/architecture/data.md`.
