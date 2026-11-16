-- Exit animation of an element: it leaves the slide at `disappears_at_s` with the effect `exit`. With `none` the element
-- stays until the slide ends and `disappears_at_s` is empty.
create type studio.exit_effect as enum ('none', 'disappear', 'fade', 'slide')
--;
alter table studio.slide_element
  add column exit studio.exit_effect not null default 'none',
  add column disappears_at_s numeric
--;
insert into studio.component_property (component, prop_key, section_key, position, advanced, visible_when) values
  ('*', 'exit', 'motion', 22, false, null),
  ('*', 'disappearsAtS', 'motion', 24, false, null)
