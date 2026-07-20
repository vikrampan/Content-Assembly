// ===========================================================================
// The QA desk's AI reviewer.
//   generateChecklist — build a brand-SPECIFIC firewall from the locked book.
//   runAiReview       — judge the copy + the deliverable images (vision) against
//                       the brand rules; return per-check verdicts + findings.
// Gated on ANTHROPIC_API_KEY.
// ===========================================================================

import Anthropic from "@anthropic-ai/sdk";
import type { ContentItem, QaAiResult, QaGroup, Workspace } from "@/lib/types";
import { hasAnthropic } from "@/lib/ai/strategist";

function brandContext(ws: Workspace): string {
  return [
    `Brand: ${ws.name}.`,
    ws.primary_hex ? `Primary colour #${ws.primary_hex}.` : "",
    ws.secondary_hex ? `Secondary #${ws.secondary_hex}.` : "",
    ws.accent_hex ? `Accent #${ws.accent_hex}.` : "",
    ws.headline_font || ws.body_font ? `Type: ${[ws.headline_font, ws.body_font].filter(Boolean).join(" / ")}.` : "",
    ws.voice_tone ? `Voice: ${ws.voice_tone}.` : "",
    ws.voice_never ? `Never use: ${ws.voice_never}.` : "",
    ws.do_rules ? `Shows: ${ws.do_rules}.` : "",
    ws.never_rules ? `Never shows: ${ws.never_rules}.` : "",
    ws.logo_rules ? `Logo rules: ${ws.logo_rules}.` : "",
    ws.brand_book?.legal?.claims_needing_proof ? `Claims needing proof: ${ws.brand_book.legal.claims_needing_proof}.` : "",
    ws.brand_book?.legal?.compliance ? `Compliance: ${ws.brand_book.legal.compliance}.` : "",
  ].filter(Boolean).join("\n");
}

function client() { return new Anthropic(); }
function textOf(msg: Anthropic.Message) { return msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim(); }
function jsonOf(text: string) { return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); }

/** Generate a brand-specific firewall checklist from the brand book. */
export async function generateChecklist(ws: Workspace): Promise<QaGroup[]> {
  if (!hasAnthropic()) return [];
  try {
    const msg = await client().messages.create({
      model: "claude-opus-4-8", max_tokens: 2000, thinking: { type: "adaptive" },
      system: [
        "You are a brand QA lead building a pre-publish firewall checklist SPECIFIC to this brand.",
        "Base every check on this brand's actual rules — cite exact colours, fonts, banned words, logo rules, and claim/compliance needs where relevant:",
        brandContext(ws),
        "Produce 4 groups (Brand & visual, Strategy & psychology, Factual & legal, Platform & deployment), each with 3–5 concrete checks.",
        "Each check: a short stable key (snake_case), a label, and a detail that references THIS brand's specifics.",
        'Return ONLY minified JSON: {"groups":[{"group":"…","checks":[{"key":"…","label":"…","detail":"…"}]}]}.',
      ].join("\n"),
      messages: [{ role: "user", content: `Build the firewall for ${ws.name}.` }],
    });
    const parsed = jsonOf(textOf(msg)) as { groups?: QaGroup[] };
    return (parsed.groups ?? []).filter((g) => g?.group && Array.isArray(g.checks)).map((g) => ({
      group: String(g.group),
      checks: g.checks.filter((c) => c?.key && c?.label).map((c) => ({ key: String(c.key), label: String(c.label), detail: String(c.detail ?? "") })),
    })).filter((g) => g.checks.length > 0);
  } catch { return []; }
}

/** AI review: assess copy + deliverable images against the firewall. */
export async function runAiReview(ws: Workspace, item: ContentItem, groups: QaGroup[], imageUrls: string[]): Promise<QaAiResult | null> {
  if (!hasAnthropic()) return null;
  const checks = groups.flatMap((g) => g.checks.map((c) => ({ key: c.key, label: c.label, detail: c.detail })));
  const copy = [`Title: ${item.title}`, item.hook && `Hook: ${item.hook}`, item.educational_shift && `Value: ${item.educational_shift}`, item.solution && `CTA: ${item.solution}`].filter(Boolean).join("\n");

  const content: Anthropic.ContentBlockParam[] = [{ type: "text", text: `Copy to review:\n${copy}\n\nChecks:\n${checks.map((c) => `- ${c.key}: ${c.label} — ${c.detail}`).join("\n")}` }];
  for (const url of imageUrls.slice(0, 4)) content.push({ type: "image", source: { type: "url", url } });
  if (imageUrls.length) content.push({ type: "text", text: "The images above are the creative deliverables for this post — inspect them for on-brand colour, logo use, and clarity." });

  try {
    const msg = await client().messages.create({
      model: "claude-opus-4-8", max_tokens: 2000, thinking: { type: "adaptive" },
      system: [
        "You are the QA brand firewall. Judge whether this post is safe to ship for the brand below. Be strict but fair.",
        brandContext(ws),
        "For EACH check key given, return a verdict: 'pass' or 'flag', and a one-line finding (what's wrong, or 'looks good').",
        "Then an overall verdict ('pass' only if nothing important is flagged) and a one-line summary.",
        'Return ONLY minified JSON: {"overall":{"verdict":"pass","summary":"…"},"checks":[{"key":"…","verdict":"flag","finding":"…"}]}.',
      ].join("\n"),
      messages: [{ role: "user", content }],
    });
    const p = jsonOf(textOf(msg)) as { overall?: { verdict?: string; summary?: string }; checks?: { key: string; verdict?: string; finding?: string }[] };
    return {
      overall: { verdict: p.overall?.verdict === "pass" ? "pass" : "flag", summary: String(p.overall?.summary ?? "") },
      checks: (p.checks ?? []).filter((c) => c?.key).map((c) => ({ key: String(c.key), verdict: c.verdict === "pass" ? "pass" : "flag", finding: String(c.finding ?? "") })),
      ranAt: new Date().toISOString(),
    };
  } catch { return null; }
}
