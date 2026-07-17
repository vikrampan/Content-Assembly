-- ===========================================================================
-- 0010_assignments.sql — Admin-routed hand-off flow
--
-- Content is routed through the admin: admin assigns an item to a desk with a
-- brief; the desk works it and returns it to admin; admin routes to the next
-- desk. `assigned_dept` = whose desk it's on right now (null = with admin).
-- RLS already lets staff read/write all content, so no new policies.
-- ===========================================================================

alter table public.content_items
  add column if not exists assigned_dept   text,   -- desk currently responsible (null = admin)
  add column if not exists assignment_note text;   -- the brief for the current hand-off

create index if not exists content_items_assigned_dept_idx
  on public.content_items (assigned_dept);
