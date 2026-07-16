-- ===========================================================================
-- 0008_ai_governance.sql — API key management, usage metering, per-user budgets
--
-- Admin adds provider keys once (team uses them), every AI call is metered so
-- admin sees who spent how much on what, and each user has a monthly token
-- budget that is enforced BEFORE the call — so bills can't explode.
-- ===========================================================================

-- --- API keys / integrations (admin-only; secret never sent to the browser) --
create table public.ai_integrations (
  provider    text primary key,           -- anthropic|image|video|audio|scraper|meta
  label       text,
  secret      text,                        -- the API key
  is_enabled  boolean not null default false,
  updated_by  uuid references public.profiles (id),
  updated_at  timestamptz not null default now()
);
alter table public.ai_integrations enable row level security;
create policy "ai_integrations: admin only"
  on public.ai_integrations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- --- Per-user monthly token budgets ----------------------------------------
create table public.ai_budgets (
  user_id             uuid primary key references public.profiles (id) on delete cascade,
  monthly_token_limit bigint not null default 0,   -- 0 = unlimited
  updated_by          uuid references public.profiles (id),
  updated_at          timestamptz not null default now()
);
alter table public.ai_budgets enable row level security;
create policy "ai_budgets: read own or admin"
  on public.ai_budgets for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "ai_budgets: admin writes"
  on public.ai_budgets for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- --- AI usage log (one row per call) ---------------------------------------
create table public.ai_usage (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  workspace_id  uuid references public.workspaces (id) on delete set null,
  purpose       text,                       -- the desk/department, e.g. 'content'
  provider      text not null default 'anthropic',
  model         text,
  input_tokens  int not null default 0,
  output_tokens int not null default 0,
  cost_usd      numeric(12,6) not null default 0,
  created_at    timestamptz not null default now()
);
create index on public.ai_usage (user_id, created_at);
create index on public.ai_usage (created_at);
alter table public.ai_usage enable row level security;
-- A user records their own usage; admin (and the user) can read it.
create policy "ai_usage: insert own"
  on public.ai_usage for insert to authenticated
  with check (user_id = auth.uid());
create policy "ai_usage: read own or admin"
  on public.ai_usage for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- --- Scrape config per brand (founder location + radius) -------------------
alter table public.workspaces
  add column if not exists scrape_location  text,
  add column if not exists scrape_radius_km int not null default 25;
