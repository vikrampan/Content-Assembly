-- ===========================================================================
-- 0001_init.sql — Core schema + Row-Level Security for the Content Assembly Line
--
-- Multi-tenant model: every tenant-scoped row carries `workspace_id`. Isolation
-- between clients is enforced at the DATABASE layer via RLS, not in app code.
--
-- Roles:
--   admin         — global access, brand governance, onboarding (account-level)
--   team_incharge — executes the 4-Layer SOP on ASSIGNED workspaces
--   client        — sees ONLY their own workspace, and only client-visible items
-- ===========================================================================

-- --- Enums -----------------------------------------------------------------
create type account_type   as enum ('admin', 'team_incharge', 'client');
create type membership_role as enum ('team_incharge', 'client');
create type content_format  as enum ('post', 'carousel', 'reel');
create type asset_kind      as enum ('raw', 'generated', 'final');

-- The pipeline stages (Layers 1-4 → Admin gate → Client gate → live).
create type content_status as enum (
  'ideation',                -- Layer 0/1: idea captured
  'research',                -- Layer 1: Fact & Asset Vault
  'copywriting',             -- Layer 2: Copywriting Matrix
  'visuals',                 -- Layer 3: Asset Studio & AI prompting
  'assembly',                -- Layer 4: Assembly & QA
  'admin_review',            -- internal gate (Admin)
  'ready_for_client_review', -- sent to Client
  'changes_requested',       -- Client rejected with comments
  'approved',                -- Client approved
  'scheduled',               -- queued for publishing
  'published'                -- live
);

-- --- Tables ----------------------------------------------------------------

-- One profile row per auth user. Account-level role lives here.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text,
  account_type account_type not null default 'client',
  created_at   timestamptz not null default now()
);

-- One workspace == one client/brand (e.g. Puresol). Holds brand governance.
create table public.workspaces (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  slug               text not null unique,
  -- Brand Book (Admin-locked): hex codes + typography rules.
  primary_hex        text,        -- e.g. 'FFF9E9' (soft warm cream)
  secondary_hex      text,
  typography         text,        -- freeform for now; structured later
  -- Visual rules auto-appended to AI prompts in Module 3 (Layer 3).
  ai_style_suffix    text,        -- e.g. 'soft warm cream HEX FFF9E9, minimalist, high-end'
  created_by         uuid references public.profiles (id),
  created_at         timestamptz not null default now()
);

-- Maps users to the workspaces they can access, and their role within it.
-- Admins do NOT need a membership — they have a global override in RLS.
create table public.memberships (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         membership_role not null,
  created_at   timestamptz not null default now(),
  unique (workspace_id, user_id)
);

-- Layer 1: The Fact & Asset Vault — verified claims per brand.
create table public.brand_facts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  claim        text not null,          -- e.g. 'pH > 9'
  detail       text,                   -- supporting context / source
  is_verified  boolean not null default false,
  created_at   timestamptz not null default now()
);

-- A single piece of content moving through the pipeline.
create table public.content_items (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces (id) on delete cascade,
  title              text not null,
  format             content_format not null default 'post',
  status             content_status not null default 'ideation',
  -- Layer 2: Copywriting Matrix (psychological stages).
  hook               text,
  educational_shift  text,
  solution           text,
  -- Client-visibility for the 'ideation' column (WIP stays hidden otherwise).
  shared_with_client boolean not null default false,
  assigned_to        uuid references public.profiles (id),
  created_by         uuid references public.profiles (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Layer 1 toggle: which vault facts are locked into a given post's brief.
create table public.content_facts (
  content_id   uuid not null references public.content_items (id) on delete cascade,
  fact_id      uuid not null references public.brand_facts (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  primary key (content_id, fact_id)
);

-- Comment threads. `internal = true` == team-only (hidden from clients).
create table public.comments (
  id           uuid primary key default gen_random_uuid(),
  content_id   uuid not null references public.content_items (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  author_id    uuid references public.profiles (id),
  body         text not null,
  internal     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Uploaded / generated assets. Actual bytes live in Supabase Storage; this
-- row is the metadata + pointer (storage_path).
create table public.assets (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  content_id   uuid references public.content_items (id) on delete set null,
  kind         asset_kind not null default 'raw',
  storage_path text not null,
  uploaded_by  uuid references public.profiles (id),
  created_at   timestamptz not null default now()
);

-- Helpful indexes for the tenant-scoped access patterns.
create index on public.memberships (user_id);
create index on public.memberships (workspace_id);
create index on public.content_items (workspace_id, status);
create index on public.comments (content_id);
create index on public.assets (workspace_id, content_id);
create index on public.brand_facts (workspace_id);

-- --- Helper functions (SECURITY DEFINER to avoid RLS recursion) ------------
-- These run with the definer's privileges so they can read membership tables
-- WITHOUT re-triggering the RLS policies that call them.

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and account_type = 'admin'
  );
$$;

create or replace function public.is_member_of(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.memberships
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create or replace function public.is_team_member_of(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.memberships
    where workspace_id = ws and user_id = auth.uid() and role = 'team_incharge'
  );
$$;

create or replace function public.is_client_of(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where workspace_id = ws and user_id = auth.uid() and role = 'client'
  );
$$;

-- Do I share ANY workspace with this other user? (For seeing teammate names.)
create or replace function public.shares_workspace(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1
    from public.memberships m1
    join public.memberships m2 on m1.workspace_id = m2.workspace_id
    where m1.user_id = auth.uid() and m2.user_id = other
  );
$$;

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep content_items.updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger content_items_touch
  before update on public.content_items
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- Row-Level Security
-- ===========================================================================
alter table public.profiles       enable row level security;
alter table public.workspaces     enable row level security;
alter table public.memberships    enable row level security;
alter table public.brand_facts    enable row level security;
alter table public.content_items  enable row level security;
alter table public.content_facts  enable row level security;
alter table public.comments       enable row level security;
alter table public.assets         enable row level security;

-- --- profiles --------------------------------------------------------------
create policy "profiles: read self / teammates / admin"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_workspace(id));

create policy "profiles: update self"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles: admin manages all"
  on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- --- workspaces ------------------------------------------------------------
create policy "workspaces: members read"
  on public.workspaces for select to authenticated
  using (public.is_member_of(id));

create policy "workspaces: admin writes"
  on public.workspaces for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- --- memberships -----------------------------------------------------------
create policy "memberships: read own / co-members / admin"
  on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.is_member_of(workspace_id));

create policy "memberships: admin writes"
  on public.memberships for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- --- brand_facts (Layer 1 vault) ------------------------------------------
-- Everyone in the workspace (incl. client) can READ verified facts.
create policy "brand_facts: members read"
  on public.brand_facts for select to authenticated
  using (public.is_member_of(workspace_id));

-- Only team incharge / admin can curate the vault.
create policy "brand_facts: team writes"
  on public.brand_facts for all to authenticated
  using (public.is_team_member_of(workspace_id))
  with check (public.is_team_member_of(workspace_id));

-- --- content_items ---------------------------------------------------------
-- Team + admin: full visibility of their workspaces (incl. WIP drafts).
create policy "content: team reads all in workspace"
  on public.content_items for select to authenticated
  using (public.is_team_member_of(workspace_id));

-- Client: ONLY their workspace, ONLY client-visible stages. WIP stays hidden.
create policy "content: client reads client-visible only"
  on public.content_items for select to authenticated
  using (
    public.is_client_of(workspace_id)
    and (
      status = any (array[
        'ready_for_client_review','changes_requested','approved','scheduled','published'
      ]::content_status[])
      or (status = 'ideation' and shared_with_client = true)
    )
  );

-- Team + admin create / edit / move content through the pipeline.
create policy "content: team writes"
  on public.content_items for insert to authenticated
  with check (public.is_team_member_of(workspace_id));

create policy "content: team updates"
  on public.content_items for update to authenticated
  using (public.is_team_member_of(workspace_id))
  with check (public.is_team_member_of(workspace_id));

create policy "content: team deletes"
  on public.content_items for delete to authenticated
  using (public.is_team_member_of(workspace_id));
-- NOTE: client approve / request-changes is a column-restricted action handled
-- by a SECURITY DEFINER RPC in a later migration, NOT a broad UPDATE grant.

-- --- content_facts ---------------------------------------------------------
create policy "content_facts: members read"
  on public.content_facts for select to authenticated
  using (public.is_member_of(workspace_id));

create policy "content_facts: team writes"
  on public.content_facts for all to authenticated
  using (public.is_team_member_of(workspace_id))
  with check (public.is_team_member_of(workspace_id));

-- --- comments --------------------------------------------------------------
-- Team + admin see every comment (internal + client-facing).
create policy "comments: team reads all"
  on public.comments for select to authenticated
  using (public.is_team_member_of(workspace_id));

-- Client sees only NON-internal comments in their workspace.
create policy "comments: client reads external only"
  on public.comments for select to authenticated
  using (public.is_client_of(workspace_id) and internal = false);

-- Team + admin can post any comment.
create policy "comments: team writes"
  on public.comments for insert to authenticated
  with check (public.is_team_member_of(workspace_id) and author_id = auth.uid());

-- Client can post only external (non-internal) comments.
create policy "comments: client writes external"
  on public.comments for insert to authenticated
  with check (
    public.is_client_of(workspace_id)
    and internal = false
    and author_id = auth.uid()
  );

create policy "comments: author deletes own"
  on public.comments for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- --- assets ----------------------------------------------------------------
create policy "assets: members read"
  on public.assets for select to authenticated
  using (public.is_member_of(workspace_id));

-- Team + admin manage all assets; clients may upload RAW assets only.
create policy "assets: team writes"
  on public.assets for all to authenticated
  using (public.is_team_member_of(workspace_id))
  with check (public.is_team_member_of(workspace_id));

create policy "assets: client uploads raw"
  on public.assets for insert to authenticated
  with check (
    public.is_client_of(workspace_id)
    and kind = 'raw'
    and uploaded_by = auth.uid()
  );
