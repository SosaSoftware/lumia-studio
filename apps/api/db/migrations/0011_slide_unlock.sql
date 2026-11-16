-- A slide no longer moves on by itself or with a click on its surface: the class shows a Next button beside the slide,
-- and the slide decides when that button turns on. `unlock` replaces `advance`:
--   always            the button is on from the start (was `click`)
--   after_timeline    on once the narration, the audio and the slide duration end (was `auto`)
--   after_activities  on once every question and game of the slide is completed (was `on_complete`)
--   after_all         on once both happen
create type studio.next_unlock as enum ('always', 'after_timeline', 'after_activities', 'after_all')
--;
alter table studio.slide add column unlock studio.next_unlock not null default 'always'
--;
update studio.slide set unlock = case advance
  when 'auto' then 'after_timeline'::studio.next_unlock
  when 'on_complete' then 'after_activities'::studio.next_unlock
  else 'always'::studio.next_unlock
end
--;
alter table studio.slide drop column advance
--;
drop type studio.advance_mode
--;
-- A pause that waits now waits for the Next button instead of a click on the slide.
alter type studio.pause_end rename value 'wait_click' to 'wait_next'
