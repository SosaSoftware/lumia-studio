-- Rules of the Next button of a slide, and the buttons a slide can rely on:
--   always            on from the start
--   after_time        on once the slide duration has run, counted from the start of the slide
--   after_activities  on once every question and game of the slide is completed
--   custom_button     the lateral Next is not used: a button of the slide (`unlock_element_id`) moves on instead
-- A slide with the rule after_time starts by itself (`start_mode` auto) or when the student presses its start button
-- (`start_mode` button, `start_element_id`). Deleting a referenced button clears the reference.
alter table studio.slide alter column unlock drop default
--;
alter table studio.slide alter column unlock type text using unlock::text
--;
drop type studio.next_unlock
--;
create type studio.next_unlock as enum ('always', 'after_time', 'after_activities', 'custom_button')
--;
update studio.slide set unlock = case unlock
  when 'after_timeline' then 'after_time'
  when 'after_all' then 'after_activities'
  else unlock
end
--;
alter table studio.slide alter column unlock type studio.next_unlock using unlock::studio.next_unlock
--;
alter table studio.slide alter column unlock set default 'always'
--;
create type studio.start_mode as enum ('auto', 'button')
--;
alter table studio.slide
  add column start_mode studio.start_mode not null default 'auto',
  add column start_element_id uuid references studio.slide_element (id) on delete set null,
  add column unlock_element_id uuid references studio.slide_element (id) on delete set null
--;
create index slide_start_element_id_idx on studio.slide (start_element_id) where start_element_id is not null
--;
create index slide_unlock_element_id_idx on studio.slide (unlock_element_id) where unlock_element_id is not null
--;
insert into studio.component_property (component, prop_key, section_key, position, advanced, visible_when) values
  ('@slide', 'unlockElementId', 'behavior', 15, false, null),
  ('@slide', 'startMode', 'behavior', 30, false, null),
  ('@slide', 'startElementId', 'behavior', 40, false, null)
