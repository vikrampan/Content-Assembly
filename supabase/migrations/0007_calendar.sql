-- ===========================================================================
-- 0007_calendar.sql — Put content on a month calendar
--
-- A planned post is just a content item with a target date. The strategy team
-- plans the month; each entry then flows through the same pipeline. RLS already
-- covers content_items, so no new policies are needed.
-- ===========================================================================

alter table public.content_items
  add column if not exists planned_date date;

create index if not exists content_items_planned_date_idx
  on public.content_items (planned_date);
