-- ===========================================================================
-- 0015_brand_designer.sql — World-class Brand Designer desk.
--
-- Keeps the existing typed columns (colours, fonts, voice, do/never, palette,
-- logo_path, …) as the canonical fields the copy desk / QA / portal already
-- read, and adds a structured `brand_book` jsonb for the long-tail sections
-- (identity, messaging, imagery, social, legal, type scale). Adds a draft→
-- locked lifecycle and full version history for diff/restore.
-- ===========================================================================

alter table public.workspaces
  add column if not exists brand_book   jsonb,                       -- structured long-tail sections
  add column if not exists brand_status text not null default 'draft', -- 'draft' | 'locked'
  add column if not exists locked_at    timestamptz,
  add column if not exists locked_by    uuid references public.profiles (id);

-- Snapshots of the whole brand book for history / diff / restore.
create table if not exists public.brand_book_versions (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  snapshot     jsonb not null,          -- full serialized brand book at save time
  note         text,                    -- e.g. "AI import from deck.pdf", "Locked"
  source       text,                    -- 'manual' | 'ai_import' | 'lock' | 'restore'
  author_id    uuid references public.profiles (id),
  created_at   timestamptz not null default now()
);
create index if not exists brand_versions_ws_idx on public.brand_book_versions (workspace_id, created_at desc);

alter table public.brand_book_versions enable row level security;

drop policy if exists "brand versions: staff read" on public.brand_book_versions;
create policy "brand versions: staff read" on public.brand_book_versions
  for select to authenticated
  using (public.is_staff() or public.is_member_of(workspace_id));

drop policy if exists "brand versions: staff write" on public.brand_book_versions;
create policy "brand versions: staff write" on public.brand_book_versions
  for insert to authenticated
  with check (public.is_staff());
