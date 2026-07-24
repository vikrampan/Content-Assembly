// Domain types mirroring the Postgres enums + tables (see supabase/migrations).
// Hand-maintained for now; will be superseded by generated Database types.

export type AccountType = "admin" | "team_incharge" | "client";
export type MembershipRole = "team_incharge" | "client";
export type ContentFormat = "post" | "carousel" | "reel";
export type AssetKind = "raw" | "generated" | "final";

export type ContentStatus =
  | "ideation"
  | "research"
  | "copywriting"
  | "visuals"
  | "assembly"
  | "admin_review"
  | "ready_for_client_review"
  | "changes_requested"
  | "approved"
  | "scheduled"
  | "published";

export interface Profile {
  id: string;
  full_name: string | null;
  account_type: AccountType;
  department: string | null;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  primary_hex: string | null;
  secondary_hex: string | null;
  typography: string | null;
  ai_style_suffix: string | null;
  created_at: string;
  scrape_location: string | null;
  scrape_radius_km: number;
  // Stage 01 — Brand DNA (the constitution). Nullable until an admin locks it.
  voice_tone: string | null;
  voice_never: string | null;
  photography_style: string | null;
  headline_font: string | null;
  body_font: string | null;
  do_rules: string | null;
  never_rules: string | null;
  locations: string | null;
  // 0014 — Brand Designer visual kit
  accent_hex: string | null;
  palette: { hex: string; name?: string }[] | null;
  logo_rules: string | null;
  logo_path: string | null;
  // 0015 — structured brand book + lifecycle
  brand_book: BrandBook | null;
  brand_status: "draft" | "locked";
  locked_at: string | null;
  locked_by: string | null;
}

/**
 * The structured long-tail of the brand book (the typed columns above hold the
 * canonical colours / fonts / voice / do-never that the copy desk & QA read;
 * this holds everything else). The AI importer fills both.
 */
export interface BrandBook {
  identity?: {
    tagline?: string;
    mission?: string;
    vision?: string;
    values?: string[];
    positioning?: string;
    story?: string;
    audience?: string;
    competitors?: string;
  };
  voice?: {
    attributes?: string[];
    mechanics?: string; // capitalisation, Oxford comma, emoji policy, reading level
    examples_good?: string[];
    examples_bad?: string[];
  };
  messaging?: {
    value_props?: string[];
    boilerplate?: string;
    elevator_pitch?: string;
    key_messages?: string[];
  };
  imagery?: {
    photography?: string;
    illustration?: string;
    iconography?: string;
    patterns?: string;
  };
  social?: {
    bio?: string;
    handle?: string;
    hashtags?: string[];
    emoji_policy?: string;
  };
  legal?: {
    claims_needing_proof?: string;
    disclaimers?: string;
    trademark?: string;
    compliance?: string;
  };
  type_scale?: { name: string; size?: string; weight?: string }[];
}

export interface BrandBookVersion {
  id: string;
  workspace_id: string;
  snapshot: Record<string, unknown>;
  note: string | null;
  source: string | null;
  author_id: string | null;
  created_at: string;
}

export type AssetKindExt = AssetKind | "logo" | "font" | "brand";

export interface ContentVersion {
  id: string;
  content_id: string;
  workspace_id: string;
  hook: string | null;
  educational_shift: string | null;
  solution: string | null;
  tone: string | null;
  note: string | null;
  author_id: string | null;
  created_at: string;
}

export interface PostMetric {
  id: string;
  content_id: string;
  workspace_id: string;
  day: string;
  reach: number;
  impressions: number;
  engagement: number;
  likes: number;
  comments: number;
  saves: number;
}

export interface Membership {
  id: string;
  workspace_id: string;
  user_id: string;
  role: MembershipRole;
  department: string | null;
}

export interface ContentItem {
  id: string;
  workspace_id: string;
  title: string;
  format: ContentFormat;
  status: ContentStatus;
  hook: string | null;
  educational_shift: string | null;
  solution: string | null;
  shared_with_client: boolean;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Stage 04 — the brief that travels with the asset.
  objective: string | null;
  format_type: string | null;
  format_rationale: string | null;
  brief: Record<string, unknown> | null;
  qa_checklist: Record<string, boolean> | null;
  planned_date: string | null;
  assigned_dept: string | null;
  assignment_note: string | null;
  stage: string;
  tone: string | null;
  scheduled_at: string | null;
  qa_notes: Record<string, string> | null;
  qa_reject_reasons: string | null;
  pillar_id: string | null;
  campaign: string | null;
  change_request: string | null;
  due_date: string | null;
  // 0018 — copy engineering
  triggers: string[];
  framework: string | null;
  devices: string[];
  hook_options: HookCandidate[] | null;
  voice_flags: VoiceFlags | null;
  qa_ai: QaAiResult | null;
}

export interface QaCheck { key: string; label: string; detail: string }
export interface QaGroup { group: string; checks: QaCheck[] }

export interface QaChecklist {
  workspace_id: string;
  groups: QaGroup[];
  ai_generated: boolean;
  updated_at: string;
}

export interface QaAiResult {
  overall: { verdict: "pass" | "flag"; summary: string };
  checks: { key: string; verdict: "pass" | "flag"; finding: string }[];
  ranAt: string;
}

export interface QaReview {
  id: string;
  content_id: string;
  workspace_id: string;
  reviewer_id: string | null;
  result: "passed" | "rejected";
  reasons: string | null;
  passed: number;
  total: number;
  created_at: string;
}

export interface HookCandidate {
  text: string;
  formula: string;
  score: { stop: number; curiosity: number; clarity: number; fit: number };
}

export interface VoiceFlags {
  score: number; // 0-100
  issues: { term: string; why: string }[];
}

export interface ContentVariant {
  id: string;
  content_id: string;
  workspace_id: string;
  platform: string;
  body: string;
  created_at: string;
}

export interface MetaConnection {
  workspace_id: string;
  page_id: string;
  page_name: string | null;
  ig_user_id: string | null;
  access_token: string; // secret — server-only
  token_expires: string | null;
  connected_by: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  workspace_id: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface ScheduledPost {
  id: string;
  content_id: string;
  workspace_id: string;
  platform: string;
  scheduled_at: string;
  status: "queued" | "published" | "canceled" | "failed";
  first_comment: string | null;
  utm: string | null;
  external_id: string | null;
  published_at: string | null;
  created_at: string;
}

export interface ContentPillar {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  color: string | null;
  sort: number;
  created_by: string | null;
  created_at: string;
}

export interface Asset {
  id: string;
  workspace_id: string;
  content_id: string | null;
  kind: AssetKind | "logo" | "font" | "brand";
  storage_path: string;
  label: string | null;
  uploaded_by: string | null;
  created_at: string;
  // 0016 — DAM metadata
  tags: string[];
  rating: number;
  select_status: "none" | "pick" | "reject";
  note: string | null;
  collection: string | null;
  captured_at: string | null;
  rights: string | null;
  // 0016 — AI generation
  prompt: string | null;
  gen_provider: string | null;
  gen_status: "ready" | "pending" | "failed";
  gen_ref: string | null;
}

export interface CaptureBrief {
  id: string;
  workspace_id: string;
  title: string;
  focus: string | null;
  shots: { shot: string; note?: string; done?: boolean }[];
  status: "open" | "shot" | "archived";
  created_by: string | null;
  created_at: string;
}

export interface CalendarApproval {
  id: string;
  workspace_id: string;
  month: string;
  status: "pending" | "approved" | "changes_requested";
  note: string | null;
  decided_at: string | null;
}

export interface Comment {
  id: string;
  content_id: string;
  workspace_id: string;
  author_id: string | null;
  body: string;
  internal: boolean;
  created_at: string;
}

export interface BrandFact {
  id: string;
  workspace_id: string;
  claim: string;
  detail: string | null;
  is_verified: boolean;
}

export interface AiPersona {
  id: string;
  workspace_id: string;
  department: string;
  name: string;
  personality: string;
  guidance: string | null;
  model: string;
  is_default: boolean;
  created_at: string;
}
