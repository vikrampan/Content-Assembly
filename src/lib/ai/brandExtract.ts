// ===========================================================================
// AI Brand Import — read a brand deck / guidelines and extract the brand book.
//
// Sends the source document(s) to Claude (native PDF + image reading) and asks
// for a strict JSON brand book plus a per-field confidence map. Everything is
// a *draft* — the designer reviews and confirms before it's applied. Gated on
// ANTHROPIC_API_KEY; without a key it returns an empty draft so the UI can
// still fall back to manual entry.
// ===========================================================================

import Anthropic from "@anthropic-ai/sdk";
import type { BrandBook } from "@/lib/types";
import { hasAnthropic } from "@/lib/ai/strategist";

export interface BrandDraftFields {
  name?: string;
  primary_hex?: string;
  secondary_hex?: string;
  accent_hex?: string;
  palette?: { hex: string; name?: string }[];
  headline_font?: string;
  body_font?: string;
  voice_tone?: string;
  voice_never?: string;
  photography_style?: string;
  do_rules?: string;
  never_rules?: string;
  locations?: string;
  logo_rules?: string;
  ai_style_suffix?: string;
}

export interface BrandDraft {
  fields: BrandDraftFields;
  brand_book: BrandBook;
  confidence: Record<string, number>;
  provider: "claude" | "stub";
  model?: string;
  usage?: { input: number; output: number };
}

export interface SourceDoc {
  media_type: string; // application/pdf, image/png, text/plain, …
  data: string; // base64 for pdf/image; raw text for text/*
  name: string;
}

const SYSTEM = [
  "You are a senior brand strategist. You are given a brand's existing brand deck, guidelines, or notes.",
  "Extract a structured brand book. Read colours, typography, voice, rules, and messaging carefully.",
  "Colours MUST be 6-digit hex WITHOUT the leading # (e.g. \"C8853F\"). If a colour is only named, infer its closest hex.",
  "Only include a field if the document actually supports it — do NOT invent. Leave unknown fields out.",
  "For every field you DO fill, add an entry to `confidence` (0.0–1.0) under the same key path.",
  "Return ONLY minified JSON, no prose, matching exactly this shape:",
  JSON.stringify({
    name: "string",
    primary_hex: "hex",
    secondary_hex: "hex",
    accent_hex: "hex",
    palette: [{ hex: "hex", name: "string" }],
    headline_font: "string",
    body_font: "string",
    voice_tone: "string",
    voice_never: "string",
    do_rules: "string",
    never_rules: "string",
    photography_style: "string",
    locations: "string",
    logo_rules: "string",
    ai_style_suffix: "one line of visual style keywords for image prompts",
    identity: { tagline: "s", mission: "s", vision: "s", values: ["s"], positioning: "s", story: "s", audience: "s", competitors: "s" },
    voice: { attributes: ["s"], mechanics: "s", examples_good: ["s"], examples_bad: ["s"] },
    messaging: { value_props: ["s"], boilerplate: "s", elevator_pitch: "s", key_messages: ["s"] },
    imagery: { photography: "s", illustration: "s", iconography: "s", patterns: "s" },
    social: { bio: "s", handle: "s", hashtags: ["s"], emoji_policy: "s" },
    legal: { claims_needing_proof: "s", disclaimers: "s", trademark: "s", compliance: "s" },
    type_scale: [{ name: "s", size: "s", weight: "s" }],
    confidence: { primary_hex: 0.9 },
  }),
].join("\n");

function emptyDraft(): BrandDraft {
  return { fields: {}, brand_book: {}, confidence: {}, provider: "stub" };
}

/** Build Anthropic content blocks from the uploaded source docs. */
function toBlocks(docs: SourceDoc[]): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = [];
  for (const d of docs) {
    if (d.media_type === "application/pdf") {
      blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: d.data } });
    } else if (d.media_type.startsWith("image/")) {
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: d.media_type as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: d.data },
      });
    } else {
      // text/* and anything we pre-extracted to text
      blocks.push({ type: "text", text: `--- ${d.name} ---\n${d.data}` });
    }
  }
  blocks.push({ type: "text", text: "Extract the brand book from the material above. Return only the JSON." });
  return blocks;
}

const HEX = /^#?[0-9a-fA-F]{6}$/;
const hex = (v: unknown) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim().replace(/^#/, "") : undefined);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const arr = (v: unknown) => (Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : undefined);

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapDraft(raw: any, provider: "claude" | "stub", model?: string, usage?: { input: number; output: number }): BrandDraft {
  const fields: BrandDraftFields = {
    name: str(raw.name),
    primary_hex: hex(raw.primary_hex),
    secondary_hex: hex(raw.secondary_hex),
    accent_hex: hex(raw.accent_hex),
    palette: Array.isArray(raw.palette)
      ? raw.palette.map((p: any) => ({ hex: hex(p?.hex) ?? "", name: str(p?.name) })).filter((p: any) => p.hex)
      : undefined,
    headline_font: str(raw.headline_font),
    body_font: str(raw.body_font),
    voice_tone: str(raw.voice_tone),
    voice_never: str(raw.voice_never),
    photography_style: str(raw.photography_style),
    do_rules: str(raw.do_rules),
    never_rules: str(raw.never_rules),
    locations: str(raw.locations),
    logo_rules: str(raw.logo_rules),
    ai_style_suffix: str(raw.ai_style_suffix),
  };

  const brand_book: BrandBook = {
    identity: raw.identity && {
      tagline: str(raw.identity.tagline), mission: str(raw.identity.mission), vision: str(raw.identity.vision),
      values: arr(raw.identity.values), positioning: str(raw.identity.positioning), story: str(raw.identity.story),
      audience: str(raw.identity.audience), competitors: str(raw.identity.competitors),
    },
    voice: raw.voice && {
      attributes: arr(raw.voice.attributes), mechanics: str(raw.voice.mechanics),
      examples_good: arr(raw.voice.examples_good), examples_bad: arr(raw.voice.examples_bad),
    },
    messaging: raw.messaging && {
      value_props: arr(raw.messaging.value_props), boilerplate: str(raw.messaging.boilerplate),
      elevator_pitch: str(raw.messaging.elevator_pitch), key_messages: arr(raw.messaging.key_messages),
    },
    imagery: raw.imagery && {
      photography: str(raw.imagery.photography), illustration: str(raw.imagery.illustration),
      iconography: str(raw.imagery.iconography), patterns: str(raw.imagery.patterns),
    },
    social: raw.social && {
      bio: str(raw.social.bio), handle: str(raw.social.handle), hashtags: arr(raw.social.hashtags), emoji_policy: str(raw.social.emoji_policy),
    },
    legal: raw.legal && {
      claims_needing_proof: str(raw.legal.claims_needing_proof), disclaimers: str(raw.legal.disclaimers),
      trademark: str(raw.legal.trademark), compliance: str(raw.legal.compliance),
    },
    type_scale: Array.isArray(raw.type_scale)
      ? raw.type_scale.map((t: any) => ({ name: str(t?.name) ?? "", size: str(t?.size), weight: str(t?.weight) })).filter((t: any) => t.name)
      : undefined,
  };
  // Prune empty section objects so the review UI stays clean.
  for (const k of Object.keys(brand_book) as (keyof BrandBook)[]) {
    const v = brand_book[k];
    if (!v || (typeof v === "object" && !Array.isArray(v) && Object.values(v).every((x) => x == null || (Array.isArray(x) && !x.length)))) {
      delete brand_book[k];
    }
  }
  const confidence = (raw.confidence && typeof raw.confidence === "object" ? raw.confidence : {}) as Record<string, number>;
  return { fields, brand_book, confidence, provider, model, usage };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function extractBrandBook(docs: SourceDoc[]): Promise<BrandDraft> {
  if (!hasAnthropic() || docs.length === 0) return emptyDraft();
  try {
    const client = new Anthropic();
    const model = "claude-opus-4-8";
    const msg = await client.messages.create({
      model,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: SYSTEM,
      messages: [{ role: "user", content: toBlocks(docs) }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json);
    return mapDraft(parsed, "claude", model, { input: msg.usage.input_tokens, output: msg.usage.output_tokens });
  } catch {
    return emptyDraft();
  }
}
