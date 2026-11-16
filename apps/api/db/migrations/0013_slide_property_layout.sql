-- The Properties panel of a slide uses the same sections as the panel of a component. The placement of the fields of a
-- slide is stored in `component_property` under the component `@slide`, next to `*` (fields of every element).
alter table studio.component_property drop constraint if exists component_property_component_check
--;
alter table studio.component_property add constraint component_property_component_check
  check (component in ('*', '@slide') or component ~ '^[a-z][a-z0-9_]*$')
--;
insert into studio.component_property (component, prop_key, section_key, position, advanced, visible_when) values
  ('@slide', 'title', 'content', 10, false, null),
  ('@slide', 'unlock', 'behavior', 10, false, null),
  ('@slide', 'durationS', 'behavior', 20, false, null),
  ('@slide', 'background', 'appearance', 10, false, null),
  ('@slide', 'transition', 'motion', 10, false, null)
