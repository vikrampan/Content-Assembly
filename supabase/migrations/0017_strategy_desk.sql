-- ===========================================================================
-- 0017_strategy_desk.sql — World-class Strategy / Monthly Plan desk.
--
-- Content pillars (a brand's recurring themes) + campaign grouping, so the
-- AI month planner can produce a balanced month and the calendar can show the
-- mix at a glance.
-- ===========================================================================

create table if not exists public.content_pillars (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name         text not null,
  description  text,
  color        text,                       -- hex (no #) for calendar chips
  sort         int not null default 0,
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now()
);
create index if not exists content_pillars_ws_idx on public.content_pillars (workspace_id, sort);

alter table public.content_items
  add column if not exists pillar_id uuid references public.content_pillars (id) on delete set null,
  add column if not exists campaign  text;   -- freeform launch / campaign grouping

alter table public.content_pillars enable row level security;

drop policy if exists "pillars: staff all" on public.content_pillars;
create policy "pillars: staff all" on public.content_pillars
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Clients may read their own brand's pillars (shown on the calendar/portal).
drop policy if exists "pillars: client reads own" on public.content_pillars;
create policy "pillars: client reads own" on public.content_pillars
  for select to authenticated using (public.is_member_of(workspace_id));
