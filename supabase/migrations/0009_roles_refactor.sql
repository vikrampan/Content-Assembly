-- ===========================================================================
-- 0009_roles_refactor.sql — SaaS role model
--
-- Internal staff work ACROSS all brands, scoped by FUNCTION (their department).
-- Clients are scoped to their own brand. Admin sees everything.
--
-- Instead of rewriting every policy, we redefine the two helper functions the
-- policies already call — flipping the whole model in one place:
--   is_team_member_of(ws)  → any staff, any brand
--   is_member_of(ws)       → any staff (all brands) OR a client of that brand
-- Function-level scoping (brand designer sees only brand books, etc.) is
-- enforced in the app's navigation + route guards, not in RLS.
-- ===========================================================================

-- A staff member's function now lives on the profile (not per-brand membership).
alter table public.profiles add column if not exists department text;

-- Carry over each existing staff member's function from their membership.
update public.profiles p
   set department = m.department
  from public.memberships m
 where m.user_id = p.id
   and m.department is not null
   and p.account_type = 'team_incharge'
   and p.department is null;

-- Any internal user (admin or staff). Clients are excluded.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and account_type in ('admin', 'team_incharge')
  );
$$;

-- Staff get full cross-brand access; the ws argument is ignored on purpose.
create or replace function public.is_team_member_of(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff();
$$;

-- Read access: any staff (all brands) OR a client member of this brand.
create or replace function public.is_member_of(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff() or exists (
    select 1 from public.memberships
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

-- Brand designers (staff) edit brand books; admin still creates/deletes brands.
drop policy if exists "workspaces: staff update" on public.workspaces;
create policy "workspaces: staff update"
  on public.workspaces for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
