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
}

export interface Asset {
  id: string;
  workspace_id: string;
  content_id: string | null;
  kind: AssetKind;
  storage_path: string;
  uploaded_by: string | null;
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
