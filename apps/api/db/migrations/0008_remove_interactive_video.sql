-- The interactive video slide type is removed. Its slides become plain video slides, which hold the same components.
-- PostgreSQL cannot drop an enum label, so the type is created again without it.
update studio.slide set type = 'video' where type = 'interactive_video'
--;
alter type studio.slide_type rename to slide_type_with_interactive_video
--;
create type studio.slide_type as enum ('cover', 'explanatory', 'video', 'whiteboard', 'quiz', 'closing')
--;
alter table studio.slide alter column type type studio.slide_type using type::text::studio.slide_type
--;
drop type studio.slide_type_with_interactive_video
