-- ===========================================================================
-- 0020_social_desk.sql — World-class Social desk.
--
-- Per-platform scheduling: one content item can be queued to several platforms,
-- each at its own time, with a first comment + UTM. The Meta publish path fills
-- external_id/published_at later; until then Social marks posts live manually.
-- ===========================================================================

create table if not exists public.scheduled_posts (
  id            uuid primary key default gen_random_uuid(),
  content_id    uuid not null references public.content_items (id) on delete cascade,
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  platform      text not null,                  -- instagram | linkedin | x | facebook | tiktok
  scheduled_at  timestamptz not null,
  status        text not null default 'queued', -- queued | published | canceled | failed
  first_comment text,
  utm           text,
  external_id   text,                            -- provider post id once published
  published_at  timestamptz,
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now(),
  unique (content_id, platform)
);
create index if not exists scheduled_posts_time_idx on public.scheduled_posts (scheduled_at);
create index if not exists scheduled_posts_ws_idx on public.scheduled_posts (workspace_id, status);

alter table public.scheduled_posts enable row level security;

drop policy if exists "scheduled: staff all" on public.scheduled_posts;
create policy "scheduled: staff all" on public.scheduled_posts
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
