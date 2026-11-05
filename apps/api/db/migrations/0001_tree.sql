-- Content tree: category → subcategory → folders and classes. Classes are the leaves that hold a document.
-- Logical names follow file-name rules (lowercase letters, digits and hyphens; classes end in `.lumia`);
-- display names are what the interface shows.
create type studio.tree_node_kind as enum ('folder', 'class')
--;
create table studio.category (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(name) <= 80),
  display_name text not null check (char_length(display_name) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  position int not null default 0,
  created_at timestamptz not null default now()
)
--;
create table studio.subcategory (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references studio.category (id) on delete cascade,
  name text not null check (name ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(name) <= 80),
  display_name text not null check (char_length(display_name) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (category_id, name)
)
--;
create index subcategory_category_id_idx on studio.subcategory (category_id)
--;
create table studio.tree_node (
  id uuid primary key default gen_random_uuid(),
  subcategory_id uuid not null references studio.subcategory (id) on delete cascade,
  parent_id uuid references studio.tree_node (id) on delete cascade,
  kind studio.tree_node_kind not null,
  name text not null check (char_length(name) <= 80),
  display_name text not null check (char_length(display_name) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  position int not null default 0,
  created_at timestamptz not null default now(),
  constraint tree_node_name_format check (
    (kind = 'folder' and name ~ '^[a-z0-9]+(-[a-z0-9]+)*$') or
    (kind = 'class' and name ~ '^[a-z0-9]+(-[a-z0-9]+)*\.lumia$')
  ),
  -- Like files in a folder, two siblings cannot share a name.
  constraint tree_node_sibling_name_key unique nulls not distinct (subcategory_id, parent_id, name),
  -- Lets class_document reference only class nodes.
  constraint tree_node_id_kind_key unique (id, kind)
)
--;
create index tree_node_subcategory_id_idx on studio.tree_node (subcategory_id)
--;
create index tree_node_parent_id_idx on studio.tree_node (parent_id)
--;
-- A class is a leaf, and a node lives in the subcategory of its parent.
create function studio.check_tree_node() returns trigger language plpgsql as $$
declare
  parent studio.tree_node;
begin
  if new.kind = 'class' and exists (select 1 from studio.tree_node child where child.parent_id = new.id) then
    raise exception 'A class cannot contain other nodes' using errcode = 'check_violation';
  end if;
  if new.parent_id is null then
    return new;
  end if;
  select * into parent from studio.tree_node where id = new.parent_id;
  if parent.kind = 'class' then
    raise exception 'A class cannot contain other nodes' using errcode = 'check_violation';
  end if;
  if parent.subcategory_id <> new.subcategory_id then
    raise exception 'A node must belong to the subcategory of its parent' using errcode = 'check_violation';
  end if;
  return new;
end
$$
--;
create trigger tree_node_check before insert or update of parent_id, subcategory_id, kind on studio.tree_node
  for each row execute function studio.check_tree_node()
