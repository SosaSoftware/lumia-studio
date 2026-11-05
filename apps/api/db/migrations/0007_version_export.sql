-- The export of a published version: a .lumia file (zip with definition.json and the media) in the published bucket.
-- export_key links the class version to its object; S3 versioning keeps earlier exports under the same key.
alter table studio.document_version
  add column if not exists export_status text
    constraint document_version_export_status_check check (export_status in ('pending', 'ready', 'failed')),
  add column if not exists export_key text,
  add column if not exists export_object_version text,
  add column if not exists exported_at timestamptz,
  add column if not exists export_error text;
