-- The name of an element is no longer part of a section of the Properties panel: the panel shows it under the
-- component, outside the sections, so its placement row is removed.
delete from studio.component_property where component = '*' and prop_key = 'name'
