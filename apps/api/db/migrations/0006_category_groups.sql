-- Optional visual groups of categories and subcategories. A group is only a heading in the menus:
-- it is not selectable and has no access rules of its own.
alter table studio.category add column if not exists group_name text
  constraint category_group_name_check check (group_name is null or length(btrim(group_name)) between 1 and 80);
--;
alter table studio.subcategory add column if not exists group_name text
  constraint subcategory_group_name_check check (group_name is null or length(btrim(group_name)) between 1 and 80);
