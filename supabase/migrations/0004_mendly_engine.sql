-- ===========================================================================
-- 0004_mendly_engine.sql — Mendly OS spine
--
-- Encodes the Mendly Labs process into the schema so the app OBEYS it, not just
-- describes it:
--   • Stage 01 (Brand Identity Book)  → Brand DNA columns on workspaces.
--       The "constitution": every downstream desk reads it; the QA firewall
--       enforces it. This is the system's Brand Memory (semantic half).
--   • Stage 04 (Strategy Desk)        → objective + format decision on content.
--   • Stage 06 (QA Brand Firewall)    → a structured, enforceable checklist.
--   • The brief that travels with every asset ("the objective travels with the
--     asset — every desk knows why it exists").
-- All changes are ADDITIVE (no enum surgery) so existing RLS/policies stand.
-- ===========================================================================

-- --- Stage 01: Brand Identity Book (Brand DNA) -----------------------------
alter table public.workspaces
  add column if not exists voice_tone        text,  -- how the brand speaks
  add column if not exists voice_never       text,  -- words/phrases it never uses
  add column if not exists photography_style text,  -- mood, light, framing references
  add column if not exists headline_font     text,  -- editorial display face
  add column if not exists body_font         text,  -- clean modern sans-serif
  add column if not exists do_rules          text,  -- what the brand posts
  add column if not exists never_rules       text,  -- what it would never post
  add column if not exists locations         text;  -- geo footprint (e.g. "Mumbai")

-- --- Stage 04: Strategy Desk (the brief that travels with the asset) --------
-- objective is the client's GOAL (maps deterministically to a format — page 8).
alter table public.content_items
  add column if not exists objective        text,   -- launch|educate|vibe|urgency
  add column if not exists format_type      text,   -- the specific chosen format
  add column if not exists format_rationale text,   -- WHY this format (never by taste)
  add column if not exists brief            jsonb,  -- structured brief the desks read
  -- Stage 06: QA firewall checklist snapshot (enforced before staging).
  add column if not exists qa_checklist     jsonb;

-- ===========================================================================
-- Seed: Cafe Kallol — the deck's worked example, with its Brand DNA locked.
-- ===========================================================================
insert into public.workspaces
  (id, name, slug, primary_hex, secondary_hex, typography, ai_style_suffix,
   voice_tone, voice_never, photography_style, headline_font, body_font,
   do_rules, never_rules, locations)
values (
  '00000000-0000-0000-0000-000000000002',
  'Cafe Kallol',
  'cafe-kallol',
  '3B2A20',                       -- warm espresso brown
  'C8853F',                       -- golden brown accent
  'Editorial serif (headlines), clean sans-serif (body)',
  'warm wood tones, golden-brown coffee hues, soft natural light, minimalist, high-end, editorial',
  'Warm, unhurried, sensory. Speaks like a host who knows craft — inviting, never salesy.',
  'Hype words, ALL-CAPS shouting, "cheap", "deal", emoji spam, exclamation stacking.',
  'Golden-hour natural light; warm wood surfaces; steam, crema and glaze in macro; the corner seat; hands and craft details.',
  'Editorial serif',
  'Clean modern sans-serif',
  'Hero product macros, steam & pour moments, interior ambience, craft details, golden-hour seating.',
  'Flat/cold phone snaps, aggressive discount posts, competitor bashing, unlicensed tracks or stock, cluttered layouts.',
  'Mumbai'
)
on conflict (id) do nothing;

-- A couple of ideation items so the Cafe Kallol board isn't empty.
insert into public.content_items
  (workspace_id, title, format, status, shared_with_client, objective)
values
  ('00000000-0000-0000-0000-000000000002', 'Monsoon warm-brew launch', 'reel', 'ideation', true,  'launch'),
  ('00000000-0000-0000-0000-000000000002', 'The sourcing story',        'carousel', 'ideation', false, 'educate')
on conflict do nothing;
