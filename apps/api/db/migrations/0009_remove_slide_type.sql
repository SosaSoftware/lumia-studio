-- The slide type is removed. What it decided (background, duration, advance mode) is stored on each slide, so the
-- column and its enum only held a label that nothing reads any more.
alter table studio.slide drop column type
--;
drop type studio.slide_type
