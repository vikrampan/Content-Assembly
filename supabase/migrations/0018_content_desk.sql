-- ===========================================================================
-- 0018_content_desk.sql — World-class Content desk.
--
-- Copy engineering that's reproducible & auditable: the chosen hook candidates,
-- the psychological triggers + framework + engagement devices applied, and the
-- brand-voice lint result travel with the content item. Per-platform variants
-- live in their own table.
-- ===========================================================================

alter table public.content_items
  add column if not exists triggers     text[] not null default '{}', -- active psychological triggers
  add column if not exists framework    text,                          -- AIDA | PAS | BAB | reel
  add column if not exists devices      text[] not null default '{}', -- engagement devices ("traps")
  add column if not exists hook_options jsonb,                         -- [{text,formula,score:{...}}]
  add column if not exists voice_flags  jsonb;                         -- {score, issues:[{term,why}]}

create table if not exists public.content_variants (
  id           uuid primary key default gen_random_uuid(),
  content_id   uuid not null references public.content_items (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  platform     text not null,                 -- instagram | linkedin | x | tiktok | facebook
  body         text not null,
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (content_id, platform)
);
create index if not exists content_variants_content_idx on public.content_variants (content_id);

alter table public.content_variants enable row level security;

drop policy if exists "variants: staff all" on public.content_variants;
create policy "variants: staff all" on public.content_variants
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "variants: member reads" on public.content_variants;
create policy "variants: member reads" on public.content_variants
  for select to authenticated using (public.is_member_of(workspace_id));
