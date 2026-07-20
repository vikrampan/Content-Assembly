-- ===========================================================================
-- 0016_capture_desk.sql — World-class Capture / Media Library desk.
--
-- Turns the flat asset store into a real DAM: tags, star ratings, a pick/reject
-- select workflow, collections (shoots), capture notes, and usage rights. Plus
-- AI capture briefs / shot lists the desk shoots against.
-- ===========================================================================

alter table public.assets
  add column if not exists tags          text[] not null default '{}',
  add column if not exists rating        int not null default 0,        -- 0 unrated … 5
  add column if not exists select_status text not null default 'none',  -- 'none' | 'pick' | 'reject'
  add column if not exists note          text,
  add column if not exists collection    text,                          -- shoot / campaign name
  add column if not exists captured_at   date,
  add column if not exists rights        text,                          -- usage / licensing note
  -- AI generation (Layer 2): prompt + provider + async status for video.
  add column if not exists prompt        text,
  add column if not exists gen_provider  text,
  add column if not exists gen_status    text not null default 'ready', -- 'ready' | 'pending' | 'failed'
  add column if not exists gen_ref       text;                          -- provider prediction id

create index if not exists assets_collection_idx on public.assets (workspace_id, collection);
create index if not exists assets_select_idx on public.assets (workspace_id, select_status);

-- AI-generated capture briefs / shot lists.
create table if not exists public.capture_briefs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title        text not null,
  focus        text,                         -- the prompt/theme it was built for
  shots        jsonb not null default '[]',  -- [{shot, note, done}]
  status       text not null default 'open', -- 'open' | 'shot' | 'archived'
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now()
);
create index if not exists capture_briefs_ws_idx on public.capture_briefs (workspace_id, created_at desc);

alter table public.capture_briefs enable row level security;

drop policy if exists "capture briefs: staff read" on public.capture_briefs;
create policy "capture briefs: staff read" on public.capture_briefs
  for select to authenticated using (public.is_staff());

drop policy if exists "capture briefs: staff writes" on public.capture_briefs;
create policy "capture briefs: staff writes" on public.capture_briefs
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
