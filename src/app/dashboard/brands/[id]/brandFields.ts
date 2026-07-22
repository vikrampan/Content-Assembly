// Shared field descriptors for the Brand Designer — used by both the AI import
// review form and the manual structured-book editor so they stay in sync.

export type Kind = "text" | "area" | "hex" | "list";
export interface Desc { path: string; label: string; kind?: Kind; hint?: string; }

export const CORE: Desc[] = [
  { path: "fields.name", label: "Brand name", hint: "The brand's display name." },
  { path: "fields.primary_hex", label: "Primary colour", kind: "hex", hint: "The brand's main colour, as a 6-digit hex code." },
  { path: "fields.secondary_hex", label: "Secondary colour", kind: "hex", hint: "The supporting brand colour." },
  { path: "fields.accent_hex", label: "Accent colour", kind: "hex", hint: "A third highlight colour used sparingly." },
  { path: "fields.headline_font", label: "Headline font", hint: "The font used for big titles." },
  { path: "fields.body_font", label: "Body font", hint: "The font used for normal running text." },
  { path: "fields.voice_tone", label: "Voice & tone", kind: "area", hint: "How the brand sounds when it talks." },
  { path: "fields.voice_never", label: "Never say", kind: "area", hint: "Words or phrases the brand must never use." },
  { path: "fields.do_rules", label: "The brand posts", kind: "area", hint: "The kinds of things the brand does post." },
  { path: "fields.never_rules", label: "The brand never posts", kind: "area", hint: "The kinds of things it would never post." },
  { path: "fields.photography_style", label: "Photography style", kind: "area", hint: "The look of the brand's photos — mood, light, framing." },
  { path: "fields.locations", label: "Locations", hint: "Where the brand operates (city / area)." },
  { path: "fields.logo_rules", label: "Logo usage rules", kind: "area", hint: "Clear-space, minimum size, and misuse don'ts for the logo." },
  { path: "fields.ai_style_suffix", label: "AI visual keywords", kind: "area", hint: "Style keywords added to AI image prompts to keep visuals on-brand." },
];

export const SECTIONS: { title: string; base: string; fields: Desc[] }[] = [
  { title: "Identity & story", base: "identity", fields: [
    { path: "tagline", label: "Tagline", hint: "The brand's short signature line." },
    { path: "mission", label: "Mission", kind: "area", hint: "Why the brand exists — the purpose." },
    { path: "vision", label: "Vision", kind: "area", hint: "The future the brand is working toward." },
    { path: "positioning", label: "Positioning", kind: "area", hint: "What makes the brand distinct in its market." },
    { path: "values", label: "Values", kind: "list", hint: "The core principles the brand stands for (one per line)." },
    { path: "story", label: "Brand story", kind: "area", hint: "The origin / narrative behind the brand." },
    { path: "audience", label: "Audience", kind: "area", hint: "Who the brand is talking to." },
    { path: "competitors", label: "Competitors", kind: "area", hint: "Key competitors and how the brand differs." },
  ]},
  { title: "Voice details", base: "voice", fields: [
    { path: "attributes", label: "Voice attributes", kind: "list", hint: "Adjectives that describe the voice, e.g. warm, expert (one per line)." },
    { path: "mechanics", label: "Grammar & mechanics", kind: "area", hint: "Rules for capitalisation, punctuation, emoji, reading level." },
    { path: "examples_good", label: "On-brand examples", kind: "list", hint: "Sample lines that sound exactly right (one per line)." },
    { path: "examples_bad", label: "Off-brand examples", kind: "list", hint: "Sample lines that sound wrong for the brand (one per line)." },
  ]},
  { title: "Messaging", base: "messaging", fields: [
    { path: "value_props", label: "Value props", kind: "list", hint: "The key benefits the brand promises (one per line)." },
    { path: "boilerplate", label: "Boilerplate", kind: "area", hint: "The standard 'about us' paragraph." },
    { path: "elevator_pitch", label: "Elevator pitch", kind: "area", hint: "The brand explained in one or two sentences." },
    { path: "key_messages", label: "Key messages", kind: "list", hint: "The main points to hit again and again (one per line)." },
  ]},
  { title: "Imagery", base: "imagery", fields: [
    { path: "illustration", label: "Illustration", kind: "area", hint: "The illustration / graphic style, if any." },
    { path: "iconography", label: "Iconography", kind: "area", hint: "The icon style the brand uses." },
    { path: "patterns", label: "Patterns & texture", kind: "area", hint: "Recurring patterns or textures in the brand's visuals." },
  ]},
  { title: "Social", base: "social", fields: [
    { path: "bio", label: "Bio", kind: "area", hint: "The social profile bio text." },
    { path: "handle", label: "Handle", hint: "The @username used across platforms." },
    { path: "hashtags", label: "Hashtags", kind: "list", hint: "Signature hashtags (one per line)." },
    { path: "emoji_policy", label: "Emoji policy", hint: "Whether/how emoji are used." },
  ]},
  { title: "Legal & compliance", base: "legal", fields: [
    { path: "claims_needing_proof", label: "Claims needing proof", kind: "area", hint: "Statements that must be substantiated before publishing." },
    { path: "disclaimers", label: "Disclaimers", kind: "area", hint: "Required disclaimers or fine print." },
    { path: "trademark", label: "Trademark", hint: "Trademark / ® usage rules." },
    { path: "compliance", label: "Compliance", kind: "area", hint: "Industry or regional rules the brand must follow." },
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
