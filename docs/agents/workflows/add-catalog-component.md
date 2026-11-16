# Add a catalog component

Adds a slide component that the editor, the API and Lumi can use. Follow an existing component of the same group as the pattern.

## Steps

1. Define it with `defineComponent` in the group file under `packages/src/catalog/components/`: key, name, group, usage, Zod props schema, defaults, default size and flags such as `usesMedia` or `isQuestion`. Build color, variant, emoji, confetti and attempts props with the helpers in `shared.ts`. A prop added to an existing component needs `.default(...)` so saved elements keep validating. Mark emoji props with `emojiProp` (`'characters'` limits the picker to figures), props kept only for old data with `.meta({ hidden: true })`, and a Mermaid text prop with `.meta({ editor: 'flowchart' | 'mindmap' })`.
2. Register it in `packages/src/catalog/index.ts`.
3. Add its renderer as a Vue block in `apps/web/src/features/slide-components/` and map it in `apps/web/src/features/slide-components/index.ts`. Use `tone.ts` for colors and variants, `motion.ts` for entrances and loops, and the `--sl-*` tokens of `slide.css`; size everything in `cqw`.
4. Add it to the editor palette in `apps/web/src/features/palette/palette.ts` (order of its group) and give it an icon `cmp-<key>` in `apps/web/src/ui/studio-icons.ts`. A new group also needs an entry in `PALETTE_GROUPS`, `COMPONENT_GROUP_NAMES`, the palette dictionaries and a `group-<name>` icon.
5. Add its name and usage to `apps/web/src/i18n/locales/{es,en}/catalog.ts`, and a label for each new prop and option to `properties.ts`, so the Properties panel shows names instead of keys.
6. Lumi discovers components through the `list_components` tool. Update a skill in `apps/agent/skills/` only if Lumi needs guidance to use it.

## Tests

Update `packages/src/catalog/catalog.test.ts`, and add a test next to the Vue block when it has behavior. `renderers.test.ts` renders every catalog component in both modes and fails when a component has no renderer.

## Verify

`npm run typecheck`, `npm run lint`, `npm run test -w @lumia/packages` and `npm run test -w @lumia/web`.

## Docs

Update `docs/overview.md` if the component adds a new concept, and add the component to its group table in `docs/development/components.md`.
