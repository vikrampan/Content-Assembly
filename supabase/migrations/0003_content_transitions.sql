-- ===========================================================================
-- 0003_content_transitions.sql — Client approve / request-changes action
--
-- Clients have NO broad UPDATE grant on content_items (see 0001). The ONLY way
-- a client mutates content is through this SECURITY DEFINER RPC, which is:
--   * workspace-scoped   — only the client's own workspace items,
--   * stage-restricted   — only while the item is awaiting client review,
--   * column-restricted  — can set status to exactly two outcomes and nothing
--                          else (never 'published', never back into WIP).
--
-- Team / admin stage moves do NOT need an RPC: they already hold an UPDATE
-- policy on content_items, so the app updates status directly under RLS.
-- ===========================================================================

create or replace function public.client_review_content(
  p_content_id uuid,
  p_decision   text,            -- 'approve' | 'request_changes'
  p_comment    text default null
)
returns public.content_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item   public.content_items;
  v_status content_status;
begin
  select * into v_item from public.content_items where id = p_content_id;
  if not found then
    raise exception 'Content not found';
  end if;

  -- Authorization: caller must be the CLIENT of this item's workspace.
  if not public.is_client_of(v_item.workspace_id) then
    raise exception 'Not authorized to review this content';
  end if;

  -- Stage gate: a client may act only while the item is awaiting their review.
  if v_item.status <> 'ready_for_client_review' then
    raise exception 'This item is not awaiting client review';
  end if;

  if p_decision = 'approve' then
    v_status := 'approved';
  elsif p_decision = 'request_changes' then
    -- Rejections must carry a comment (the "time-stamped feedback" in the SOP).
    if coalesce(btrim(p_comment), '') = '' then
      raise exception 'A comment is required when requesting changes';
    end if;
    v_status := 'changes_requested';
  else
    raise exception 'Invalid decision: %', p_decision;
  end if;

  update public.content_items
     set status = v_status
   where id = p_content_id
  returning * into v_item;

  -- Attach the client's note as a NON-internal comment (visible to the team).
  if coalesce(btrim(p_comment), '') <> '' then
    insert into public.comments (content_id, workspace_id, author_id, body, internal)
    values (p_content_id, v_item.workspace_id, auth.uid(), btrim(p_comment), false);
  end if;

  return v_item;
end;
$$;

-- Only signed-in users may call it; the function body does the fine-grained check.
revoke all     on function public.client_review_content(uuid, text, text) from public;
grant  execute on function public.client_review_content(uuid, text, text) to authenticated;
