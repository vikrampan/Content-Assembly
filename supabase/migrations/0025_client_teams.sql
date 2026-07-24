-- 0025_client_teams.sql — multiple client users per brand (owner + reviewers).
alter table public.memberships add column if not exists client_role text; -- 'owner' | 'reviewer'
