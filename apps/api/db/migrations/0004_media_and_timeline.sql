-- Media library (one per category), slide elements and the timeline: narration, pauses and audio.
create type studio.entrance as enum ('none', 'appear', 'fade', 'slide', 'draw')
--;
create type studio.narration_status as enum ('pending', 'generating', 'ready', 'failed')
--;
create type studio.audio_kind as enum ('music', 'effect')
--;
create type studio.pause_end as enum ('continue', 'wait_click')
--;
create table studio.media_asset (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references studio.category (id) on delete restrict,
  s3_key text not null unique,
  mime_type text not null,
  name text not null,
  size_bytes bigint not null,
  uploaded_by text not null,
  created_at timestamptz not null default now()
)
--;
create index media_asset_category_id_idx on studio.media_asset (category_id)
--;
create table studio.slide_element (
  id uuid primary key default gen_random_uuid(),
  slide_id uuid not null references studio.slide (id) on delete cascade,
  component text not null,
  name text not null default '',
  x numeric not null,
  y numeric not null,
  w numeric not null,
  h numeric not null,
  z smallint not null default 0,
  appears_at_s numeric not null default 0,
  entrance studio.entrance not null default 'none',
  props jsonb not null default '{}'::jsonb,
  media_id uuid references studio.media_asset (id)
)
--;
create index slide_element_slide_id_idx on studio.slide_element (slide_id)
--;
-- The voice is a Polly voice id; it stays null until the person picks one of the voices Polly lists.
create table studio.narration_clip (
  id uuid primary key default gen_random_uuid(),
  slide_id uuid not null references studio.slide (id) on delete cascade,
  starts_at_s numeric not null default 0,
  script text not null check (char_length(script) <= 3000),
  voice text,
  speed numeric not null default 1 check (speed between 0.1 and 2),
  generated_duration_s numeric not null default 0,
  audio_key text,
  speech_marks_key text,
  status studio.narration_status not null default 'pending',
  error_message text
)
--;
create index narration_clip_slide_id_idx on studio.narration_clip (slide_id)
--;
create table studio.pause (
  id uuid primary key default gen_random_uuid(),
  slide_id uuid not null references studio.slide (id) on delete cascade,
  starts_at_s numeric not null default 0,
  duration_s numeric not null default 0,
  message text not null default '',
  on_end studio.pause_end not null default 'continue',
  timer_element_id uuid references studio.slide_element (id) on delete set null
)
--;
create index pause_slide_id_idx on studio.pause (slide_id)
--;
create table studio.audio_clip (
  id uuid primary key default gen_random_uuid(),
  slide_id uuid not null references studio.slide (id) on delete cascade,
  media_id uuid not null references studio.media_asset (id),
  starts_at_s numeric not null default 0,
  duration_s numeric not null,
  name text not null,
  kind studio.audio_kind not null,
  volume numeric not null default 1 check (volume between 0 and 1)
)
--;
create index audio_clip_slide_id_idx on studio.audio_clip (slide_id)
