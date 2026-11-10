# Data model

Current tables, relations, enums and data rules of the `studio` schema in PostgreSQL. No single file defines the current schema: it is the result of applying the migrations in order, so read this page before reading them. The human version, with diagrams, is [docs/architecture/data.md](../../architecture/data.md).

## Where it is defined

| What | Location |
|---|---|
| Migrations, append-only and applied in order | `apps/api/db/migrations/0000_bootstrap.sql` to `0009_remove_slide_type.sql` |
| Statements that read and write each table | `apps/api/src/repositories/` |
| Shapes returned by the API | `apps/api/src/domain/dto.ts`, `apps/api/src/graphql/schema.graphql` |
| Enums as the database has them | `apps/api/test/integration/schema.integration.test.ts` (`defines the studio enums`) |
| Database user of the API | `0000_bootstrap.sql`: `studio_app` has `select`, `insert`, `update` and `delete` on every table of `studio` |

All primary keys are `uuid` with `gen_random_uuid()`, except `role_permission`.

## Tree and access

| Table | Key columns | References (on delete) | Notes |
|---|---|---|---|
| `category` | `id`, `name` (unique), `display_name`, `group_name`, `position` | — | Owns a media library. |
| `subcategory` | `id`, `category_id`, `name`, `display_name`, `group_name`, `position` | `category` (cascade) | `(category_id, name)` is unique. |
| `tree_node` | `id`, `subcategory_id`, `parent_id`, `kind`, `name`, `display_name`, `position` | `subcategory` (cascade), `tree_node` (cascade) | `kind` is `folder` or `class`. A class is a leaf. |
| `role` | `id`, `key` (unique), `name`, `description` | — | |
| `role_permission` | `role_id`, `permission_key` (primary key together) | `role` (cascade) | `permission_key` is an action: `area.action`, see `ACTIONS` in `apps/api/src/auth/permissions.ts`. |
| `app_user` | `id`, `email` (`citext`, unique), `name`, `role_id`, `status` | `role` (no action) | `role_id` can be null. |
| `access_grant` | `id`, `user_id`, `category_id`, `subcategory_id` | `app_user`, `category`, `subcategory` (all cascade) | Exactly one of the two targets is set. |

## Content

| Table | Key columns | References (on delete) | Notes |
|---|---|---|---|
| `class_document` | `id`, `node_id` (unique), `node_kind`, `status`, `current_version`, `published_version`, `updated_by` | `tree_node (id, kind)` (restrict) | One document per class. `node_kind` is always `class`. |
| `document_version` | `id`, `document_id`, `number`, `status`, `published_at`, `export_status`, `export_key`, `export_object_version`, `exported_at`, `export_error` | `class_document` (cascade) | `(document_id, number)` is unique. `export_status` is `pending`, `ready` or `failed`. |
| `slide` | `id`, `version_id`, `position`, `title`, `background`, `duration_s`, `transition`, `advance` | `document_version` (cascade) | `background` is a theme color key stored as text. |
| `slide_element` | `id`, `slide_id`, `component`, `name`, `x`, `y`, `w`, `h`, `z`, `appears_at_s`, `entrance`, `props`, `media_id` | `slide` (cascade), `media_asset` (no action) | `props` is `jsonb`. |
| `narration_clip` | `id`, `slide_id`, `starts_at_s`, `script`, `voice`, `speed`, `generated_duration_s`, `audio_key`, `speech_marks_key`, `status`, `error_message` | `slide` (cascade) | `script` has at most 3000 characters. |
| `pause` | `id`, `slide_id`, `starts_at_s`, `duration_s`, `message`, `on_end`, `timer_element_id` | `slide` (cascade), `slide_element` (set null) | |
| `audio_clip` | `id`, `slide_id`, `media_id`, `starts_at_s`, `duration_s`, `name`, `kind`, `volume` | `slide` (cascade), `media_asset` (no action) | `volume` is between 0 and 1. |
| `slide_comment` | `id`, `slide_id`, `author_sub`, `author_name`, `body`, `created_at` | `slide` (cascade) | |

## Media

| Table | Key columns | References (on delete) | Notes |
|---|---|---|---|
| `media_asset` | `id`, `category_id`, `s3_key` (unique), `mime_type`, `name`, `size_bytes`, `uploaded_by` | `category` (restrict) | The file is in the `Media` bucket under `s3_key`. |

## Enums

| Enum | Values |
|---|---|
| `tree_node_kind` | `folder`, `class` |
| `user_status` | `active`, `disabled` |
| `document_status` | `draft`, `published` |
| `version_status` | `draft`, `published`, `archived` |
| `transition` | `none`, `fade`, `slide`, `zoom` |
| `advance_mode` | `auto`, `click`, `on_complete` |
| `entrance` | `none`, `appear`, `fade`, `slide`, `draw` |
| `narration_status` | `pending`, `generating`, `ready`, `failed` |
| `audio_kind` | `music`, `effect` |
| `pause_end` | `continue`, `wait_click` |

## Rules the data relies on

| Rule | Defined in |
|---|---|
| A document has at most one draft version. | Partial unique index `document_version_single_draft_idx`, `0003_documents.sql` |
| The slides of a version have consecutive positions starting at 1. The uniqueness of `(version_id, position)` is checked at commit, so a reorder can pass through repeated values. | `0003_documents.sql`, `apps/api/src/repositories/slide-repository.ts` (`openGap`, `applyOrder`) |
| A class has no children, and a node belongs to the subcategory of its parent. | Trigger `tree_node_check` and function `studio.check_tree_node`, `0001_tree.sql` |
| Names are lowercase with hyphens; a class name ends in `.lumia`; siblings, including those at the root of a subcategory, cannot share a name. | `tree_node_name_format` and `tree_node_sibling_name_key`, `0001_tree.sql` |
| A document belongs to a class, and a class with a document cannot be deleted. | Foreign key `(node_id, node_kind)` with restrict, `0003_documents.sql` |
| An access grant targets a category or a subcategory, never both. | `access_grant_one_target`, `0002_access.sql` |
| Deleting a category, subcategory, node, version or slide deletes what hangs from it. | `on delete cascade`, `0001` to `0004` |
| A medium in use, or a category that has media, cannot be deleted. | Foreign keys without cascade and `on delete restrict`, `0004_media_and_timeline.sql` |
| Deleting an element clears the timer of the pauses that pointed to it. | `pause.timer_element_id`, `on delete set null`, `0004_media_and_timeline.sql` |
| Publishing archives the previous published version. | `apps/api/src/services/publish-service.ts`, `apps/api/src/repositories/version-repository.ts` (`archive`) |
| Creating a version copies slides, elements, pauses, audio clips and narration clips with new ids. Comments are not copied. | `apps/api/src/repositories/slide-copier.ts` |
| The ids of a published version are not the ones of its draft, so a client that edits a published class maps the old ids to the new ones. | `IdRemap` in `apps/web/src/features/editor/document-session.ts` |
| The database does not validate `slide_element.props` or `slide.background`: the services do. | `ElementValidator` in `apps/api/src/services/element-validator.ts`, `apps/api/src/services/slide-service.ts` (`THEME_COLOR_KEYS`) |

## Before you change it

Follow [add-migration](../workflows/add-migration.md). When tables, columns or relations change, update this page, [docs/architecture/data.md](../../architecture/data.md) and the diagrams `docs/diagrams/er-tree-access.svg` and `docs/diagrams/er-content.svg`.
