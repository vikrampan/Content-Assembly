-- ===========================================================================
-- seed.sql — Demo data: the Puresol workspace, its brand facts, and a few
-- content items spread across the pipeline so each role's board has something
-- to show.
--
-- Users are NOT created here (they live in auth.users). After creating users
-- in the Supabase dashboard, set their roles + memberships — see the block at
-- the bottom, and the README "Provisioning users" section.
-- ===========================================================================

-- --- Puresol workspace (Brand Book locked by Admin) ------------------------
insert into public.workspaces (id, name, slug, primary_hex, secondary_hex, typography, ai_style_suffix)
values (
  '00000000-0000-0000-0000-000000000001',
  'Puresol',
  'puresol',
  'FFF9E9',            -- soft warm cream
  '2B2822',
  'Editor''s Note (headlines), Inter (body)',
  'soft warm cream color HEX FFF9E9, minimalist, high-end'
)
on conflict (id) do nothing;

-- --- Layer 1: Fact & Asset Vault -------------------------------------------
insert into public.brand_facts (workspace_id, claim, detail, is_verified) values
  ('00000000-0000-0000-0000-000000000001', 'pH > 9',            'Naturally alkaline source water.',        true),
  ('00000000-0000-0000-0000-000000000001', '54+ minerals',      'Full-spectrum trace mineral profile.',    true),
  ('00000000-0000-0000-0000-000000000001', 'Zero Microplastics','Independently lab-verified, per batch.',  true)
on conflict do nothing;

-- --- Sample content across the pipeline ------------------------------------
-- Titles chosen so you can eyeball role visibility:
--   * WIP items (research/copywriting/visuals/assembly/admin_review) are HIDDEN
--     from the client by RLS.
--   * 'ready_for_client_review' + 'approved' + shared 'ideation' ARE visible.
insert into public.content_items
  (workspace_id, title, format, status, shared_with_client, hook, educational_shift, solution)
values
  ('00000000-0000-0000-0000-000000000001', 'Alkaline myth-busting carousel', 'carousel', 'research',                 false, null, null, null),
  ('00000000-0000-0000-0000-000000000001', 'Microplastics reel script',      'reel',     'copywriting',              false, 'What''s really in your "pure" water?', null, null),
  ('00000000-0000-0000-0000-000000000001', '54 minerals visual explainer',   'post',     'visuals',                  false, null, null, null),
  ('00000000-0000-0000-0000-000000000001', 'Golden Harvest launch teaser',   'post',     'admin_review',             false, null, null, null),
  ('00000000-0000-0000-0000-000000000001', 'pH > 9 hero post',               'post',     'ready_for_client_review',  false, 'Not all water is created equal.', 'Most bottled water sits near neutral pH.', 'Puresol is naturally alkaline at pH > 9.'),
  ('00000000-0000-0000-0000-000000000001', 'Founder story reel',             'reel',     'ready_for_client_review',  false, null, null, null),
  ('00000000-0000-0000-0000-000000000001', 'Weekend hydration idea',         'post',     'ideation',                 true,  null, null, null),
  ('00000000-0000-0000-0000-000000000001', 'Mineral spotlight (approved)',   'carousel', 'approved',                 false, null, null, null),
  ('00000000-0000-0000-0000-000000000001', 'Zero microplastics (scheduled)', 'post',     'scheduled',                false, null, null, null)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- After creating auth users, wire up roles + memberships. Replace the UUIDs
-- with the real auth.users ids (Dashboard → Authentication → Users).
--
--   update public.profiles set account_type = 'admin'
--     where id = '<admin-user-uuid>';
--
--   update public.profiles set account_type = 'team_incharge'
--     where id = '<creator-user-uuid>';
--   insert into public.memberships (workspace_id, user_id, role)
--     values ('00000000-0000-0000-0000-000000000001', '<creator-user-uuid>', 'team_incharge');
--
--   update public.profiles set account_type = 'client'
--     where id = '<client-user-uuid>';
--   insert into public.memberships (workspace_id, user_id, role)
--     values ('00000000-0000-0000-0000-000000000001', '<client-user-uuid>', 'client');
-- ---------------------------------------------------------------------------
