// ===========================================================================
// The Mendly master architecture — the 8 engineered stages (deck page 3) and
// the QA Brand Firewall checklist (deck page 11 + the client QA protocol).
//
// This is the canonical process the OS obeys. The existing content_status
// pipeline (see 0001) is the working substrate; this maps those statuses to
// the named Mendly stages for display and for the firewall gate.
// ===========================================================================

import type { ContentStatus } from "@/lib/types";

export interface MendlyStage {
  n: string;
  name: string;
  blurb: string;
  /** content_status values that live in this stage. */
  statuses: ContentStatus[];
  /** Is this desk primarily human/creative-tool work the OS orchestrates? */
  human?: boolean;
}

export const MENDLY_STAGES: MendlyStage[] = [
  { n: "01", name: "Brand identity book", blurb: "The single source of truth", statuses: [] },
  { n: "02", name: "On-site media capture", blurb: "Directed by a creative director", statuses: [], human: true },
  { n: "03", name: "Media sandbox", blurb: "Triage · grading · audio", statuses: [], human: true },
  { n: "04", name: "Strategy desk", blurb: "Your brief + research = format", statuses: ["ideation", "research"] },
  { n: "05", name: "Posts / Reels lane", blurb: "Design · copy · edit", statuses: ["copywriting", "visuals", "assembly"] },
  { n: "06", name: "QA brand firewall", blurb: "Brand book enforcement", statuses: ["admin_review"] },
  { n: "07", name: "Staging dashboard", blurb: "Your sign-off · 3-day buffer", statuses: ["ready_for_client_review", "changes_requested"] },
  { n: "08", name: "Deployment strike", blurb: "Peak hour · geo-tagged", statuses: ["approved", "scheduled", "published"] },
];

// ---------------------------------------------------------------------------
// The QA Brand Firewall checklist (Stage 06). Nothing ships until every item
// passes. Encoded from deck page 11 + the client QA protocol phases.
// ---------------------------------------------------------------------------
export interface QaCheckDef {
  key: string;
  label: string;
  detail: string;
}

export interface QaGroupDef {
  group: string;
  checks: QaCheckDef[];
}

export const QA_FIREWALL: QaGroupDef[] = [
  {
    group: "Brand & visual identity",
    checks: [
      { key: "colors", label: "Exact color codes", detail: "Every hue matches the locked palette — no drift, no filters gone rogue." },
      { key: "logo", label: "Logo safe-zones", detail: "Spacing and minimum-size rules intact on every layout." },
      { key: "type", label: "Typography & voice", detail: "Right typefaces & weights; the caption sounds like the brand." },
      { key: "minimal", label: "Minimalist hierarchy", detail: "No clutter; the key data is instantly scannable." },
    ],
  },
  {
    group: "Strategy & psychology",
    checks: [
      { key: "hook", label: "Hook validation", detail: "First slide/3 seconds pulls a specific psychological lever." },
      { key: "sowhat", label: "The \"So What?\" test", detail: "Value is clear within 5 seconds — sells value, not features." },
      { key: "arc", label: "Emotional arc", detail: "Disruption → education → premium solution flows logically." },
      { key: "cta", label: "Single clear CTA", detail: "One unmistakable directive; link matches the promise." },
    ],
  },
  {
    group: "Factual & legal",
    checks: [
      { key: "claims", label: "Claim verification", detail: "All stats/health statements backed; no hyperbole." },
      { key: "positioning", label: "Subtle positioning", detail: "Competitor comparisons graceful & indirect — no bashing." },
      { key: "licenses", label: "Copyright & clearances", detail: "Tracks, images, icons, fonts licensed for commercial use." },
      { key: "sensitivity", label: "Sensitivity check", detail: "No clash with local tragedies, politics, or cultural taboos." },
    ],
  },
  {
    group: "Platform & deployment",
    checks: [
      { key: "safezones", label: "Aspect ratio & safe zones", detail: "Cropped per platform; UI never covers text or logo." },
      { key: "geotags", label: "Geotags & locations", detail: "Locations mapped correctly; hyper-local tags in place." },
      { key: "links", label: "Links & menus verified", detail: "Every link, menu item and price checked live." },
      { key: "calendar", label: "Calendar fit", detail: "Lands where the month's strategy says it should." },
    ],
  },
];

export const QA_CHECK_COUNT = QA_FIREWALL.reduce((n, g) => n + g.checks.length, 0);
