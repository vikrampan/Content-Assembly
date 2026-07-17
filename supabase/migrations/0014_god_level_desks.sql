-- ===========================================================================
-- 0014_god_level_desks.sql
-- Real production tooling for every desk:
--   • Brand Designer  → brand-level asset kinds (logo/font) + palette + logo rules
--   • Content         → version history + tone
--   • Creative desks  → deliverables are just assets.content_id (already there)
--   • QA              → structured checklist notes (qa_checklist jsonb already)
--   • Social          → scheduled_at
--   • Client          → per-post suggestions (reuse comments) + metrics table
-- ===========================================================================

-- --- Brand Designer -------------------------------------------------------
alter type asset_kind add value if not exists 'logo';
alter type asset_kind add value if not exists 'font';
alter type asset_kind add value if not exists 'brand';

alter table public.assets
  add column if not exists label text;            -- human name for brand assets

alter table public.workspaces
  add column if not exists accent_hex     text,   -- third brand colour
  add column if not exists palette        jsonb,  -- [{hex,name}] extra swatches
  add column if not exists logo_rules     text,   -- clear-space / min-size / don'ts
  add column if not exists logo_path      text;   -- primary logo (assets storage path)

-- --- Content desk ---------------------------------------------------------
alter table public.content_items
  add column if not exists tone text;             -- last tone preset used

-- --- QA desk (structured firewall) ---------------------------------------
alter table public.content_items
  add column if not exists qa_notes           jsonb, -- {checkKey: "evidence/note"}
  add column if not exists qa_reject_reasons  text;  -- taxonomy tags on send-back

create table if not exists public.content_versions (
  id                uuid primary key default gen_random_uuid(),
  content_id        uuid not null references public.content_items (id) on delete cascade,
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  hook              text,
  educational_shift text,
  solution          text,
  tone              text,
  note              text,
  author_id         uuid references public.profiles (id),
  created_at        timestamptz not null default now()
);
create index if not exists content_versions_content_idx on public.content_versions (content_id, created_at desc);

alter table public.content_versions enable row level security;
drop policy if exists "versions: staff read" on public.content_versions;
create policy "versions: staff read" on public.content_versions for select to authenticated
  using (public.is_staff() or public.is_member_of(workspace_id));
drop policy if exists "versions: staff write" on public.content_versions;
create policy "versions: staff write" on public.content_versions for insert to authenticated
  with check (public.is_staff());

-- --- Social desk ----------------------------------------------------------
alter table public.content_items
  add column if not exists scheduled_at timestamptz;  -- when Social queues it
create index if not exists content_scheduled_idx on public.content_items (scheduled_at)
  where scheduled_at is not null;

-- --- Client analytics -----------------------------------------------------
-- One row per post per day; populated by the Meta ingest later. Empty for now.
create table if not exists public.post_metrics (
  id           uuid primary key default gen_random_uuid(),
  content_id   uuid not null references public.content_items (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  day          date not null,
  reach        int not null default 0,
  impressions  int not null default 0,
  engagement   int not null default 0,
  likes        int not null default 0,
  comments     int not null default 0,
  saves        int not null default 0,
  created_at   timestamptz not null default now(),
  unique (content_id, day)
);
alter table public.post_metrics enable row level security;
drop policy if exists "metrics: workspace reads" on public.post_metrics;
create policy "metrics: workspace reads" on public.post_metrics for select to authenticated
  using (public.is_staff() or public.is_member_of(workspace_id));
drop policy if exists "metrics: staff writes" on public.post_metrics;
create policy "metrics: staff writes" on public.post_metrics for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- --- Granular calendar suggestions ---------------------------------------
-- Clients leave per-post suggestions during month review. Reuse comments:
-- internal=false, author is the client. Allow clients to insert on their own
-- workspace's client-visible items.
drop policy if exists "comments: client suggests on own workspace" on public.comments;
create policy "comments: client suggests on own workspace"
  on public.comments for insert to authenticated
  with check (
    internal = false
    and public.is_member_of(workspace_id)
  );

drop policy if exists "comments: workspace reads non-internal" on public.comments;
create policy "comments: workspace reads non-internal"
  on public.comments for select to authenticated
  using (
    public.is_staff()
    or (public.is_member_of(workspace_id) and internal = false)
  );
