# Add a catalog component

Adds a slide component that the editor, the API and Lumi can use. Follow an existing component of the same group as the pattern.

## Steps

1. Define it with `defineComponent` in the group file under `packages/src/catalog/components/`: key, name, group, usage, Zod props schema, defaults, default size and flags such as `usesMedia` or `isQuestion`.
2. Register it in `packages/src/catalog/index.ts`.
3. Add its renderer as a Vue block in `apps/web/src/features/slide-components/` and map it in `apps/web/src/features/slide-components/index.ts`.
4. Add it to the editor palette in `apps/web/src/features/palette/` if people should insert it by hand.
5. Lumi discovers components through the `list_components` tool. Update a skill in `apps/agent/skills/` only if Lumi needs guidance to use it.

## Tests

Update `packages/src/catalog/catalog.test.ts`, and add a test next to the Vue block when it has behavior.

## Verify

`npm run typecheck`, `npm run lint`, `npm run test -w @lumia/packages` and `npm run test -w @lumia/web`.

## Docs

Update `docs/overview.md` if the component adds a new concept.
