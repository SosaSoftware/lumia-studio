# Glossary

Domain terms with their names in code and the file that defines each. User-facing strings in the code are Spanish; identifiers are English.

| Term | Name in code | Defined in | Meaning |
|---|---|---|---|
| Studio schema | `studio` | [data-model.md](data-model.md) | PostgreSQL schema that holds every table: current tables, relations, enums and data rules. |
| Category | `studio.category`, GraphQL `Category` | `apps/api/db/migrations/0001_tree.sql` | First level of the content tree. Owns a media library. |
| Subcategory | `studio.subcategory`, `Subcategory` | `0001_tree.sql` | Second level; belongs to one category. |
| Menu group | `group_name`, `groupName` | `0006_category_groups.sql` | Visual heading in menus. No access rules. |
| Tree node | `studio.tree_node`, `TreeNode`, `kind` `folder` or `class` | `0001_tree.sql` | Folder or class inside a subcategory. Class names end in `.lumia`. |
| Class | `tree_node` with `kind = 'class'` plus `studio.class_document`, `ClassDocument` | `0001_tree.sql`, `0003_documents.sql` | Leaf of the tree that holds content. Without a document its status is `no_content`. |
| Version | `studio.document_version`, `DocumentVersion`, status `draft`, `published`, `archived` | `0003_documents.sql` | Numbered copy of a class's content. |
| Draft | `document_version` with `status = 'draft'` | `0003_documents.sql` (unique partial index), `apps/api/src/repositories/version-locator.ts` | The only editable version; at most one per document. |
| Editing version | `editingVersion` | `apps/api/src/graphql/schema.graphql` | The draft if one exists, otherwise the published version. |
| Publication | `publishVersion`, `PublishService`, `export_status` | `apps/api/src/services/publish-service.ts`, `0007_version_export.sql` | Turns the draft into the published version, archives the previous one, requests the export. |
| `.lumia` file | `buildArchive`, `exportKey`, `LUMIA_FORMAT_VERSION` | `apps/api/src/services/lumia-archive.ts` | Zip with `definition.json`, media and narration audio of a published version, stored in bucket `Published`. |
| Slide | `studio.slide`, `Slide` | `0003_documents.sql`, `packages/src/catalog/slide-properties.ts` | Screen of a class: title, background, duration, transition, advance mode. |
| Advance mode | `ADVANCE_MODES`: `auto`, `click`, `on_complete` | `packages/src/catalog/slide-properties.ts` | How a slide moves on. |
| Element (component instance) | `studio.slide_element`, `SlideElement` | `0004_media_and_timeline.sql` | A component placed on a slide: `component` key, `props`, geometry `x y w h`, `z`, `appearsAtS`. |
| Component | `ComponentDefinition`, `defineComponent` | `packages/src/catalog/component-definition.ts` | Catalog entry: key, group, usage, Zod `propsSchema`, defaults, default size, `usesMedia`, `isQuestion`. |
| Catalog | `ComponentCatalog`, `componentCatalog`, `BASE_COMPONENTS` | `packages/src/catalog/component-catalog.ts`, `packages/src/catalog/index.ts` | Single source of components for API, web and Lumi. |
| Slide units | `SLIDE_WIDTH` 100, `SLIDE_HEIGHT` 56.25 | `packages/src/catalog/geometry.ts` | Geometry is in container query units (`cqw`). |
| Layout engine | `SlideLayoutEngine`, `slideLayoutEngine` | `packages/src/catalog/layout/slide-layout-engine.ts` | Places the elements of a slide without overlaps: the title on top and the rest below it. |
| Media asset | `studio.media_asset`, `MediaAsset` | `0004_media_and_timeline.sql`, `apps/api/src/services/media-service.ts` | File in a category's library, key `media/<categoryId>/<assetId>/<file>`. |
| Timeline | `studio.narration_clip`, `studio.audio_clip`, `studio.pause` | `0004_media_and_timeline.sql` | Time-based items of a slide. |
| Narration | `NarrationClip`, `NarrationService`, status `pending`, `generating`, `ready`, `failed` | `apps/api/src/services/narration-service.ts` | Script voiced with Amazon Polly. |
| Comment | `studio.slide_comment`, `SlideComment` | `0003_documents.sql` | Note on a slide. Not copied to a new version (`apps/api/src/repositories/slide-copier.ts`). |
| Person | `studio.app_user` | `0002_access.sql` | Account matched by email; status `active` or `disabled`; one role. |
| Role | `studio.role`, `studio.role_permission` | `0002_access.sql`, `apps/api/src/authorization/policy-generator.ts` | Set of actions; one Cedar policy per role. |
| Action | `ACTIONS`, `PERMISSION_CATALOG` | `apps/api/src/auth/permissions.ts` | Permission Cedar evaluates: `documents.view`, `documents.edit`, `documents.publish`, `media.upload`, `narration.generate`. |
| Access grant | `studio.access_grant` | `0002_access.sql` | A whole category or one subcategory where a person uses the actions of their role. |
| Claims | `StudioClaims` | `apps/api/src/auth/claims.ts` | Role, actions and granted ids read from the database for each request. |
| Field registry | `STUDIO_FIELDS`, `FieldDefinition` | `apps/api/src/graphql/fields.ts`, `apps/api/src/graphql/appsync/field-registry.ts` | Action, handler and scoped record of each GraphQL field. |
| Handler family | `HANDLERS`: `documents`, `media`, `narration`, `publish`, `tree` | `apps/api/src/handlers/index.ts` | Group of fields served by one Lambda. |
| MCP target | `MCP_TARGETS`: `studio-read`, `studio-slides`, `studio-elements`, `studio-timeline` | `apps/api/src/mcp/targets.ts` | One Lambda target of the gateway. Tools are exposed as `<target>___<tool>`. |
| Studio tool | `StudioTool`, `defineTool` | `apps/api/src/mcp/tool-definition.ts` | Tool Lumi calls; it calls GraphQL with the person's token. |
| Screen tool | `TOOL_DECLARATIONS` | `apps/web/src/features/lumi/frontend-tools.ts` | Tool declared by the web and run in the browser, such as `open_class` or `confirm_change`. |
| Consent | `confirm_change`, `ConfirmationGate`, `ConfirmationPolicy` | `apps/agent/src/interventions/`, `apps/agent/policies/confirmation.json` | The person's acceptance of a change; valid once, in the same turn, with the same arguments. |
| Turn | `turnStart` | `apps/agent/src/interventions/conversation-reading.ts` | From a message of the person to the end of Lumi's work on it. |
| Skill | `skills/<name>/SKILL.md`, `LumiAssets` | `apps/agent/src/lumi-assets.ts` | Instructions Lumi loads on demand. |
| Screen context | `buildContext`, `ScreenContext` | `apps/web/src/features/lumi/frontend-tools.ts`, `apps/agent/src/server/screen-context.ts` | What the person sees, sent with every run and sanitized by the server. |
| Draft id map | `IdRemap`, `draft.idMap` | `apps/api/src/mcp/draft.ts` | Old id → new id when a write had to create a draft. |
| Actor key | `actorKeyOf` | `apps/agent/src/storage/state-keys.ts` | Hash of the token `sub` that keys Lumi's storage per person. |
