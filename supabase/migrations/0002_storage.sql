-- ===========================================================================
-- 0002_storage.sql — Asset storage buckets + RLS
--
-- Bucket layout: files are stored under `<workspace_id>/...` so the first path
-- segment identifies the tenant. RLS on storage.objects keys off that segment
-- to guarantee one client's high-res images / video never leak to another.
-- ===========================================================================

-- Private bucket for raw uploads, AI-generated backgrounds, and final comps.
-- Not public: access is always brokered through signed URLs + RLS.
insert into storage.buckets (id, name, public, file_size_limit)
values ('assets', 'assets', false, 5368709120)  -- 5 GiB ceiling for 8k / video
on conflict (id) do nothing;

-- Helper: the workspace id is the first folder segment of the object path.
create or replace function public.storage_workspace_id(object_name text)
returns uuid language sql immutable as $$
  select nullif(split_part(object_name, '/', 1), '')::uuid;
$$;

-- Read: any member of the owning workspace.
create policy "assets bucket: members read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'assets'
    and public.is_member_of(public.storage_workspace_id(name))
  );

-- Write (insert): team incharge / admin anywhere; clients into their workspace.
create policy "assets bucket: members upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'assets'
    and public.is_member_of(public.storage_workspace_id(name))
  );

-- Update / delete: team incharge / admin only.
create policy "assets bucket: team manages"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'assets'
    and public.is_team_member_of(public.storage_workspace_id(name))
  );

create policy "assets bucket: team deletes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'assets'
    and public.is_team_member_of(public.storage_workspace_id(name))
  );
