-- ===========================================================================
-- 0021_client_portal.sql — World-class client portal.
-- Let a client read their own brand's publish schedule (read-only).
-- ===========================================================================
drop policy if exists "scheduled: member reads" on public.scheduled_posts;
create policy "scheduled: member reads" on public.scheduled_posts
  for select to authenticated using (public.is_member_of(workspace_id));
