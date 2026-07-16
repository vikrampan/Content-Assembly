-- ===========================================================================
-- 0005_ai_personas.sql — Configurable AI "brains" per department, per brand
--
-- Each department can tune the personality of the AI that assists it — e.g. the
-- Content desk sets a "bold performance-marketing strategist" persona, the
-- Design desk sets a different one. The persona is injected ahead of the brand
-- book so the AI keeps the brand's voice while adopting the strategist's stance.
-- Wired into the copy desk today; the same personas will drive future AI desks
-- (image / video / audio / research).
-- ===========================================================================

create table public.ai_personas (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  department   text not null,            -- strategy | content | design | video | image | audio | capture | qa | social
  name         text not null,
  personality  text not null,            -- the persona/system instruction ("You are a …")
  guidance     text,                     -- extra direction appended after the brand book
  model        text not null default 'claude-opus-4-8',
  is_default   boolean not null default false,
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index on public.ai_personas (workspace_id, department);

create trigger ai_personas_touch
  before update on public.ai_personas
  for each row execute function public.touch_updated_at();

alter table public.ai_personas enable row level security;

-- Everyone in the workspace can read the personas (so desks can pick one).
create policy "ai_personas: members read"
  on public.ai_personas for select to authenticated
  using (public.is_member_of(workspace_id));

-- Team incharge / admin curate them.
create policy "ai_personas: team writes"
  on public.ai_personas for all to authenticated
  using (public.is_team_member_of(workspace_id))
  with check (public.is_team_member_of(workspace_id));

-- Seed a sensible default Content persona for every existing brand.
insert into public.ai_personas (workspace_id, department, name, personality, guidance, is_default)
select id, 'content', 'Default Content Strategist',
  'You are a sharp, brand-obedient content strategist. You turn attention into action — every line earns its place. You never sacrifice the brand''s voice for a cheap hook, and you never make a claim the brand cannot back.',
  'Lead with the single most compelling idea. Keep it human and specific.',
  true
from public.workspaces
on conflict do nothing;
