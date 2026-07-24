-- ===========================================================================
-- 0024_meta_connections.sql — per-brand Meta (Instagram/Facebook) connection.
-- One connection per workspace, captured via OAuth. The access_token is a
-- secret: staff-only RLS, and it must NEVER be selected into client-bound
-- queries or shipped to the browser.
-- ===========================================================================
create table if not exists public.meta_connections (
  workspace_id  uuid primary key references public.workspaces (id) on delete cascade,
  page_id       text not null,
  page_name     text,
  ig_user_id    text,
  access_token  text not null,           -- long-lived Page access token
  token_expires timestamptz,
  connected_by  uuid references public.profiles (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.meta_connections enable row level security;
-- Staff only. Never expose to clients (holds the secret token).
drop policy if exists "meta: staff all" on public.meta_connections;
create policy "meta: staff all" on public.meta_connections
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
