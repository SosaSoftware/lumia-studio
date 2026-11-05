-- People, roles and grants of Lumia Studio. One role per person; the role gives the actions and the grants give the
-- categories or single subcategories where the person can use them. People and grants are managed in the database.
create type studio.user_status as enum ('active', 'disabled')
--;
create table studio.role (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null,
  description text not null default ''
)
--;
create table studio.role_permission (
  role_id uuid not null references studio.role (id) on delete cascade,
  permission_key text not null check (permission_key ~ '^[a-z]+(_[a-z]+)*\.[a-z]+(_[a-z]+)*$'),
  primary key (role_id, permission_key)
)
--;
create table studio.app_user (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  name text not null check (char_length(name) between 1 and 160),
  role_id uuid references studio.role (id),
  status studio.user_status not null default 'active',
  created_at timestamptz not null default now()
)
--;
-- A grant is a whole category (with every subcategory it has or will have) or a single subcategory.
create table studio.access_grant (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references studio.app_user (id) on delete cascade,
  category_id uuid references studio.category (id) on delete cascade,
  subcategory_id uuid references studio.subcategory (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint access_grant_one_target check ((category_id is null) <> (subcategory_id is null)),
  constraint access_grant_unique unique nulls not distinct (user_id, category_id, subcategory_id)
)
--;
create index access_grant_user_id_idx on studio.access_grant (user_id)
