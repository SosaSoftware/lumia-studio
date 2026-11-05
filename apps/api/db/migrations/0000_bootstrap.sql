-- Schema and application role of Lumia Studio. The migrator runs as the admin user; the API connects as studio_app.
create extension if not exists pgcrypto
--;
create extension if not exists citext
--;
create schema if not exists studio
--;
do $$
begin
  if not exists (select from pg_roles where rolname = 'studio_app') then
    create role studio_app login;
  end if;
end
$$
--;
-- Extensions such as citext live in public; keep them visible to the application role.
alter role studio_app set search_path = studio, public
--;
grant usage on schema studio to studio_app
--;
-- Tables created from now on are readable and writable by the API; the migration log is not (it predates this grant).
alter default privileges in schema studio grant select, insert, update, delete on tables to studio_app
