-- Clients can read their brand's calendar entries (planned posts) so they can
-- review and approve the month, even while those items are still in production.
create policy "content: client reads planned calendar"
  on public.content_items for select to authenticated
  using (public.is_client_of(workspace_id) and planned_date is not null);
