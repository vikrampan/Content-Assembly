-- ===========================================================================
-- 0022_client_change_routing.sql
-- The client's per-post change request carries a TYPE (media / content /
-- editing / combination) that routes the card straight to the right desk.
-- Runs SECURITY DEFINER so the client can trigger the move without stage write
-- access; still guarded to the client's own brand + the client_review stage.
-- ===========================================================================

alter table public.content_items
  add column if not exists change_request text;  -- last requested change type

create or replace function public.client_request_change(
  p_content_id uuid, p_change_type text, p_note text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ws uuid;
  v_stage text;
  v_target text;
begin
  select workspace_id, stage into v_ws, v_stage from public.content_items where id = p_content_id;
  if v_ws is null then raise exception 'not found'; end if;
  if not public.is_client_of(v_ws) then raise exception 'not authorized'; end if;
  if v_stage <> 'client_review' then raise exception 'post is not awaiting your review'; end if;

  v_target := case p_change_type
    when 'content' then 'content'
    when 'combination' then 'content'
    else 'production'  -- media / editing changes go to the production desk
  end;

  update public.content_items
    set stage = v_target,
        change_request = p_change_type,
        assignment_note = 'Client change (' || p_change_type || '): ' || coalesce(p_note, '')
    where id = p_content_id;

  insert into public.comments (content_id, workspace_id, author_id, body, internal)
  values (p_content_id, v_ws, auth.uid(), 'Change requested [' || p_change_type || ']: ' || coalesce(p_note, ''), false);
end;
$$;

grant execute on function public.client_request_change(uuid, text, text) to authenticated;
