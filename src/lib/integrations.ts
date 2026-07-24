// Server-only: which platform integrations are configured (env-based today;
// moves behind the admin key vault later). Never returns the key values.
import { hasAnthropic } from "@/lib/ai/strategist";
import { hasReplicate } from "@/lib/ai/mediaGen";
import { hasMeta } from "@/lib/social/publish";
import { hasResend } from "@/lib/email/resend";
import { hasServiceRole } from "@/lib/supabase/admin";

export interface IntegrationStatus {
  key: string;
  label: string;
  on: boolean;
  unlocks: string;
  env: string;
}

export function integrationStatus(): IntegrationStatus[] {
  return [
    { key: "anthropic", label: "Claude (Anthropic)", on: hasAnthropic(), unlocks: "All AI: brand import, planning, copy, QA, media prompts", env: "ANTHROPIC_API_KEY" },
    { key: "replicate", label: "Replicate (image/video)", on: hasReplicate(), unlocks: "AI image & video generation in the Media desk", env: "REPLICATE_API_TOKEN" },
    { key: "meta", label: "Meta (publishing + analytics)", on: hasMeta(), unlocks: "Auto-publish + live analytics", env: "META_ACCESS_TOKEN" },
    { key: "resend", label: "Resend (email)", on: hasResend(), unlocks: "Client & team notification emails", env: "RESEND_API_KEY" },
    { key: "service", label: "Supabase service role", on: hasServiceRole(), unlocks: "Admin user management (create/reset logins)", env: "SUPABASE_SERVICE_ROLE_KEY" },
  ];
}
