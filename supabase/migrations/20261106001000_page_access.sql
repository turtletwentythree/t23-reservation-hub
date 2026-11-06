-- Admin-controlled page access per role.
-- Shape: {"host": ["dashboard", "reservations", ...], "viewer": [...]}.
-- A role missing from the object uses the built-in default pages.
-- This only hides pages; row level security still limits what each role can read or change.
alter table public.organizations
  add column if not exists page_access jsonb not null default '{}'::jsonb;
