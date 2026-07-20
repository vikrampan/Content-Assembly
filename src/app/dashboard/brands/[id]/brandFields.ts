// Shared field descriptors for the Brand Designer — used by both the AI import
// review form and the manual structured-book editor so they stay in sync.

export type Kind = "text" | "area" | "hex" | "list";
export interface Desc { path: string; label: string; kind?: Kind; }

export const CORE: Desc[] = [
  { path: "fields.name", label: "Brand name" },
  { path: "fields.primary_hex", label: "Primary colour", kind: "hex" },
  { path: "fields.secondary_hex", label: "Secondary colour", kind: "hex" },
  { path: "fields.accent_hex", label: "Accent colour", kind: "hex" },
  { path: "fields.headline_font", label: "Headline font" },
  { path: "fields.body_font", label: "Body font" },
  { path: "fields.voice_tone", label: "Voice & tone", kind: "area" },
  { path: "fields.voice_never", label: "Never say", kind: "area" },
  { path: "fields.do_rules", label: "The brand posts", kind: "area" },
  { path: "fields.never_rules", label: "The brand never posts", kind: "area" },
  { path: "fields.photography_style", label: "Photography style", kind: "area" },
  { path: "fields.locations", label: "Locations" },
  { path: "fields.logo_rules", label: "Logo usage rules", kind: "area" },
  { path: "fields.ai_style_suffix", label: "AI visual keywords", kind: "area" },
];

export const SECTIONS: { title: string; base: string; fields: Desc[] }[] = [
  { title: "Identity & story", base: "identity", fields: [
    { path: "tagline", label: "Tagline" }, { path: "mission", label: "Mission", kind: "area" },
    { path: "vision", label: "Vision", kind: "area" }, { path: "positioning", label: "Positioning", kind: "area" },
    { path: "values", label: "Values", kind: "list" }, { path: "story", label: "Brand story", kind: "area" },
    { path: "audience", label: "Audience", kind: "area" }, { path: "competitors", label: "Competitors", kind: "area" },
  ]},
  { title: "Voice details", base: "voice", fields: [
    { path: "attributes", label: "Voice attributes", kind: "list" }, { path: "mechanics", label: "Grammar & mechanics", kind: "area" },
    { path: "examples_good", label: "On-brand examples", kind: "list" }, { path: "examples_bad", label: "Off-brand examples", kind: "list" },
  ]},
  { title: "Messaging", base: "messaging", fields: [
    { path: "value_props", label: "Value props", kind: "list" }, { path: "boilerplate", label: "Boilerplate", kind: "area" },
    { path: "elevator_pitch", label: "Elevator pitch", kind: "area" }, { path: "key_messages", label: "Key messages", kind: "list" },
  ]},
  { title: "Imagery", base: "imagery", fields: [
    { path: "photography", label: "Photography", kind: "area" }, { path: "illustration", label: "Illustration", kind: "area" },
    { path: "iconography", label: "Iconography", kind: "area" }, { path: "patterns", label: "Patterns & texture", kind: "area" },
  ]},
  { title: "Social", base: "social", fields: [
    { path: "bio", label: "Bio", kind: "area" }, { path: "handle", label: "Handle" },
    { path: "hashtags", label: "Hashtags", kind: "list" }, { path: "emoji_policy", label: "Emoji policy" },
  ]},
  { title: "Legal & compliance", base: "legal", fields: [
    { path: "claims_needing_proof", label: "Claims needing proof", kind: "area" }, { path: "disclaimers", label: "Disclaimers", kind: "area" },
    { path: "trademark", label: "Trademark" }, { path: "compliance", label: "Compliance", kind: "area" },
  ]},
];

/* eslint-disable @typescript-eslint/no-explicit-any */
export const getPath = (o: any, p: string) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
export function setPath(o: any, p: string, v: any) {
  const keys = p.split(".");
  const next = { ...o };
  let cur = next;
  for (let i = 0; i < keys.length - 1; i++) { cur[keys[i]] = { ...(cur[keys[i]] ?? {}) }; cur = cur[keys[i]]; }
  cur[keys[keys.length - 1]] = v;
  return next;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
