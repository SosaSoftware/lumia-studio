-- Interactive content of a class: a document with numbered versions; only one draft at a time.
create type studio.document_status as enum ('draft', 'published')
--;
create type studio.version_status as enum ('draft', 'published', 'archived')
--;
create type studio.slide_type as enum ('cover', 'explanatory', 'video', 'interactive_video', 'whiteboard', 'quiz', 'closing')
--;
create type studio.transition as enum ('none', 'fade', 'slide', 'zoom')
--;
create type studio.advance_mode as enum ('auto', 'click')
--;
create table studio.class_document (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null unique,
  node_kind studio.tree_node_kind not null default 'class' check (node_kind = 'class'),
  status studio.document_status not null default 'draft',
  current_version int not null default 0,
  published_version int,
  updated_by text not null,
  updated_at timestamptz not null default now(),
  -- Only a class node holds a document, and a class with content cannot be deleted by accident.
  constraint class_document_node_fkey foreign key (node_id, node_kind) references studio.tree_node (id, kind) on delete restrict on update restrict
)
--;
create table studio.document_version (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references studio.class_document (id) on delete cascade,
  number int not null,
  status studio.version_status not null default 'draft',
  created_by text not null,
  created_at timestamptz not null default now(),
  published_by text,
  published_at timestamptz,
  unique (document_id, number)
)
--;
create unique index document_version_single_draft_idx on studio.document_version (document_id) where status = 'draft'
--;
create table studio.slide (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references studio.document_version (id) on delete cascade,
  position smallint not null,
  type studio.slide_type not null,
  title text not null default '',
  background text not null default '',
  duration_s numeric not null default 10,
  transition studio.transition not null default 'none',
  advance studio.advance_mode not null default 'click',
  unique (version_id, position) deferrable initially deferred
)
--;
create table studio.slide_comment (
  id uuid primary key default gen_random_uuid(),
  slide_id uuid not null references studio.slide (id) on delete cascade,
  author_sub text not null,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
)
--;
create index slide_comment_slide_id_idx on studio.slide_comment (slide_id)
