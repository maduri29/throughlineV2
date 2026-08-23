-- Throughline sync tier (ADR-0005).
--
-- Run once against a fresh Supabase project:
--   Dashboard -> SQL Editor -> paste -> Run
--
-- SECURITY NOTE, read before editing anything below.
-- The publishable key ships inside the client bundle by design. A table WITHOUT
-- row level security is therefore a public API that anyone holding that key can
-- read and write. Every table here enables RLS in the same block that creates
-- it, and every policy is scoped to auth.uid(). Do not add a table to this file
-- without doing the same.

-- ---------------------------------------------------------------- projects --
-- One row per story graph. `payload` is the envelope from data/envelope.ts,
-- stored whole rather than shredded into columns: the client already has a
-- validated round-trip for that shape, and mirroring the graph into relational
-- tables would mean two schemas to migrate in lockstep for no query we need
-- server-side today.
create table if not exists public.projects (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users (id) on delete cascade,
  -- Client-side project id (UUIDv7). Lets a device recognise its own project
  -- after a reinstall instead of creating a duplicate.
  local_id        text not null,
  title           text not null default 'Untitled',
  schema_version  integer not null default 1,
  payload         jsonb not null,
  -- Bumped by the client on every push; used to detect a stale overwrite.
  revision        bigint not null default 1,
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (owner_id, local_id)
);

alter table public.projects enable row level security;

-- Owner-scoped access. Separate policies per verb so a future "shared with me"
-- read policy can be added without loosening writes.
create policy "projects_select_own"
  on public.projects for select
  using (auth.uid() = owner_id);

create policy "projects_insert_own"
  on public.projects for insert
  with check (auth.uid() = owner_id);

create policy "projects_update_own"
  on public.projects for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "projects_delete_own"
  on public.projects for delete
  using (auth.uid() = owner_id);

create index if not exists projects_owner_updated_idx
  on public.projects (owner_id, updated_at desc);

-- --------------------------------------------------------------- revisions --
-- Server-side touch of updated_at/revision. Doing this in a trigger rather than
-- trusting the client means a device with a wrong clock, or an older build,
-- cannot write a timestamp that makes a stale push look newer than it is.
create or replace function public.touch_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  new.revision := coalesce(old.revision, 0) + 1;
  return new;
end;
$$;

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch
  before update on public.projects
  for each row execute function public.touch_project();

-- ------------------------------------------------------------------- notes --
-- Deliberately NOT created here:
--   * a `nodes` / `edges` relational mirror -- see the payload note above
--   * any table without RLS
--   * anything requiring the secret key at runtime
