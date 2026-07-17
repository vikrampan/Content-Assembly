-- ===========================================================================
-- 0011_calendar_approvals.sql — Client sign-off on the monthly calendar
--
-- Admin builds the month's calendar; the client approves it (or requests
-- changes) once per month. Staff manage all; a client acts only on their brand.
-- ===========================================================================

create table public.calendar_approvals (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  month        date not null,                    -- first day of the month
  status       text not null default 'pending',  -- pending | approved | changes_requested
  note         text,
  decided_by   uuid references public.profiles (id),
  decided_at   timestamptz,
  unique (workspace_id, month)
);

alter table public.calendar_approvals enable row level security;

create policy "cal_approvals: staff all"
  on public.calendar_approvals for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "cal_approvals: client reads own"
  on public.calendar_approvals for select to authenticated
  using (public.is_client_of(workspace_id));

create policy "cal_approvals: client inserts own"
  on public.calendar_approvals for insert to authenticated
  with check (public.is_client_of(workspace_id));

create policy "cal_approvals: client updates own"
  on public.calendar_approvals for update to authenticated
  using (public.is_client_of(workspace_id))
  with check (public.is_client_of(workspace_id));
