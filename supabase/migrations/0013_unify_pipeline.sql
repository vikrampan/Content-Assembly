-- ===========================================================================
-- 0013_unify_pipeline.sql — single `stage` drives everything
-- ===========================================================================
alter table public.content_items
  add column if not exists stage text not null default 'planning';
create index if not exists content_items_stage_idx on public.content_items (stage);

-- Client visibility is now keyed off stage (not the legacy status enum).
drop policy if exists "content: client reads client-visible only" on public.content_items;
create policy "content: client reads client-visible only"
  on public.content_items for select to authenticated
  using (
    public.is_client_of(workspace_id)
    and stage in ('client_review','scheduling','published')
  );

-- Client review acts on stage: approve -> scheduling, changes -> production.
create or replace function public.client_review_content(
  p_content_id uuid, p_decision text, p_comment text default null
) returns public.content_items
language plpgsql security definer set search_path = public as $$
declare v_item public.content_items; v_stage text;
begin
  select * into v_item from public.content_items where id = p_content_id;
  if not found then raise exception 'Content not found'; end if;
  if not public.is_client_of(v_item.workspace_id) then raise exception 'Not authorized'; end if;
  if v_item.stage <> 'client_review' then raise exception 'This item is not awaiting your review'; end if;
  if p_decision = 'approve' then
    v_stage := 'scheduling';
  elsif p_decision = 'request_changes' then
    if coalesce(btrim(p_comment),'') = '' then raise exception 'A comment is required when requesting changes'; end if;
    v_stage := 'production';
  else raise exception 'Invalid decision: %', p_decision; end if;
  update public.content_items set stage = v_stage where id = p_content_id returning * into v_item;
  if coalesce(btrim(p_comment),'') <> '' then
    insert into public.comments (content_id, workspace_id, author_id, body, internal)
    values (p_content_id, v_item.workspace_id, auth.uid(), btrim(p_comment), false);
  end if;
  return v_item;
end; $$;
