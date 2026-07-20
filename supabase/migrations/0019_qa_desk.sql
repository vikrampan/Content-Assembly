-- ===========================================================================
-- 0019_qa_desk.sql — World-class QA / Brand Firewall desk.
--
-- Per-brand firewalls (generated from each brand's locked book), AI review
-- findings stored on the item, and a QA review log that powers analytics
-- (first-pass rate, reject reasons, throughput).
-- ===========================================================================

-- One firewall checklist per brand (groups of checks). Absent = use the default.
create table if not exists public.qa_checklists (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  groups       jsonb not null default '[]',   -- [{group, checks:[{key,label,detail}]}]
  ai_generated boolean not null default false,
  updated_by   uuid references public.profiles (id),
  updated_at   timestamptz not null default now()
);

alter table public.qa_checklists enable row level security;
drop policy if exists "qa checklists: staff all" on public.qa_checklists;
create policy "qa checklists: staff all" on public.qa_checklists
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Store the AI reviewer's findings on the item.
alter table public.content_items
  add column if not exists qa_ai jsonb;   -- {overall:{verdict,summary}, checks:[{key,verdict,finding}], ranAt}

-- Every QA decision, for analytics.
create table if not exists public.qa_reviews (
  id           uuid primary key default gen_random_uuid(),
  content_id   uuid not null references public.content_items (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  reviewer_id  uuid references public.profiles (id),
  result       text not null,                 -- 'passed' | 'rejected'
  reasons      text,
  passed       int not null default 0,
  total        int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists qa_reviews_ws_idx on public.qa_reviews (workspace_id, created_at desc);

alter table public.qa_reviews enable row level security;
drop policy if exists "qa reviews: staff all" on public.qa_reviews;
create policy "qa reviews: staff all" on public.qa_reviews
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
