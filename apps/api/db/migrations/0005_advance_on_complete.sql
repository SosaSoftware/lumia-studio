-- A slide can wait until every question on it is answered correctly or runs out of attempts.
alter type studio.advance_mode add value if not exists 'on_complete'
