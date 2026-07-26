"use server";

// Client-facing AI actions. Each resolves the caller's own brand (RLS-scoped),
// builds a grounded prompt from real data, and runs through the budget-guarded
// runClientAi. Anyone who isn't a client is refused.

import { requireSession } from "@/lib/auth";
import { userFunction } from "@/lib/mendly/access";
import { createClient } from "@/lib/supabase/server";
import { runClientAi, clientBudgetStatus, BudgetError, type BudgetStatus } from "@/lib/ai/clientAssist";
import type { Workspace, ContentItem, PostMetric, BrandBook } from "@/lib/types";

export interface AiReply { text?: string; error?: string; overBudget?: boolean; budget?: BudgetStatus }

async function clientCtx() {
  const session = await requireSession();
  if (userFunction(session.profile) !== "client") throw new Error("Clients only.");
  const db = await createClient();
  const { data: ws } = await db.from("workspaces").select("*").limit(1).maybeSingle<Workspace>();
  return { db, userId: session.userId, ws };
}

function brandBrief(ws: Workspace): string {
  const b = ws.brand_book ?? {};
  return [
    `Brand: ${ws.name}`,
    ws.subject && `Makes: ${ws.subject}`,
    b.identity?.positioning && `Positioning: ${b.identity.positioning}`,
    b.identity?.audience && `Audience: ${b.identity.audience}`,
    ws.voice_tone && `Voice: ${ws.voice_tone}`,
    ws.never_rules && `Never posts: ${ws.never_rules}`,
  ].filter(Boolean).join("\n");
}

const VOICE =
  "You are the brand's friendly account concierge speaking directly to the CLIENT (the brand owner), not to internal staff. Be warm, plain-spoken, and concise. Never invent numbers or facts beyond what you're given. No markdown headings — short sentences or tight bullets.";

async function run(purpose: string, system: string, user: string, maxTokens = 600): Promise<AiReply> {
  try {
    const { db, userId, ws } = await clientCtx();
    if (!ws) return { error: "Your brand workspace isn't set up yet." };
    const res = await runClientAi({ db, userId, workspaceId: ws.id, purpose, system, user, maxTokens });
    return { text: res.text, budget: res.budget };
  } catch (e) {
    if (e instanceof BudgetError) return { error: e.message, overBudget: true };
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

/** How much AI allowance the client has left this month (for the UI meter). */
export async function aiBudget(): Promise<BudgetStatus | null> {
  try {
    const { db, userId } = await clientCtx();
    return await clientBudgetStatus(db, userId);
  } catch {
    return null;
  }
}

/** Home: a warm 2–3 sentence "here's where things stand" digest. */
export async function aiHomeDigest(): Promise<AiReply> {
  const { db, ws } = await clientCtx();
  if (!ws) return { error: "Your brand workspace isn't set up yet." };
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const now = new Date();
  const mStart = iso(new Date(now.getFullYear(), now.getMonth(), 1));
  const mEnd = iso(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const { data: cal } = await db.from("content_items").select("title, stage, planned_date, format")
    .not("planned_date", "is", null).gte("planned_date", mStart).lte("planned_date", mEnd);
  const posts = (cal as Pick<ContentItem, "title" | "stage" | "planned_date" | "format">[]) ?? [];
  const pending = posts.filter((p) => p.stage === "client_review");
  const scheduled = posts.filter((p) => p.stage === "scheduling").length;
  const live = posts.filter((p) => p.stage === "published").length;
  const ctx = [
    brandBrief(ws),
    `This month: ${posts.length} posts planned, ${scheduled} scheduled, ${live} already published.`,
    `Waiting on you to approve: ${pending.length}${pending.length ? ` — ${pending.map((p) => `"${p.title}"`).join(", ")}` : ""}.`,
  ].join("\n");
  return run("client_digest",
    VOICE + " Give a 2–3 sentence status update, then one clear next step. Sound encouraging.",
    ctx, 350);
}

/** Insights: a plain-English read of performance + what to do next month. */
export async function aiInsightsSummary(): Promise<AiReply> {
  const { db, ws } = await clientCtx();
  if (!ws) return { error: "Your brand workspace isn't set up yet." };
  const [{ data: mRaw }, { data: pRaw }] = await Promise.all([
    db.from("post_metrics").select("*"),
    db.from("content_items").select("id, title, format, objective").in("stage", ["scheduling", "published"]),
  ]);
  const metrics = (mRaw as PostMetric[]) ?? [];
  if (metrics.length === 0) return { error: "There's no performance data yet — this lights up once posts are live." };
  const posts = (pRaw as Pick<ContentItem, "id" | "title" | "format" | "objective">[]) ?? [];
  const meta = new Map(posts.map((p) => [p.id, p]));
  const agg = new Map<string, { reach: number; eng: number; saves: number }>();
  for (const m of metrics) {
    const c = agg.get(m.content_id) ?? { reach: 0, eng: 0, saves: 0 };
    c.reach += m.reach; c.eng += m.engagement; c.saves += m.saves;
    agg.set(m.content_id, c);
  }
  const rows = [...agg.entries()].map(([id, v]) => {
    const p = meta.get(id);
    return `"${p?.title ?? "Post"}" (${p?.format ?? "?"}, ${p?.objective ?? "?"}): reach ${v.reach}, engagements ${v.eng}, saves ${v.saves}`;
  }).sort().join("\n");
  return run("client_insights",
    VOICE + " Explain in plain English what worked and why (look at format & objective patterns), name the standout post, then give ONE concrete recommendation for next month. Keep it under 140 words.",
    `${brandBrief(ws)}\n\nPer-post results this period:\n${rows}`, 500);
}

/** Approvals/Calendar: why this specific post exists, in the client's language. */
export async function aiExplainPost(contentId: string): Promise<AiReply> {
  const { db, ws } = await clientCtx();
  if (!ws) return { error: "Your brand workspace isn't set up yet." };
  const { data: item } = await db.from("content_items")
    .select("title, format, format_type, objective, hook, educational_shift, solution, campaign")
    .eq("id", contentId).maybeSingle<Pick<ContentItem, "title" | "format" | "format_type" | "objective" | "hook" | "educational_shift" | "solution" | "campaign">>();
  if (!item) return { error: "Post not found." };
  const ctx = [
    brandBrief(ws),
    `Post: "${item.title}" (${item.format})`,
    item.objective && `Goal: ${item.objective}`,
    item.format_type && `Creative direction: ${item.format_type}`,
    item.hook && `Hook: ${item.hook}`,
    item.educational_shift && `Body: ${item.educational_shift}`,
    item.solution && `Call to action: ${item.solution}`,
    item.campaign && `Campaign: ${item.campaign}`,
  ].filter(Boolean).join("\n");
  return run("client_explain",
    VOICE + " In 2–3 short sentences, explain to the brand owner WHY the team made this post this way and how it helps their goals. Reassure, don't lecture.",
    ctx, 300);
}

// -------------------------------------------------------------------------
// Brand Book copilot — propose structured changes the client reviews & applies.
// -------------------------------------------------------------------------

/** The fields the copilot may propose, with human labels. `.`-paths write into brand_book. */
export const COPILOT_FIELDS: Record<string, string> = {
  voice_tone: "Voice & tone",
  voice_never: "Words it never uses",
  do_rules: "What the brand posts",
  never_rules: "What it never posts",
  photography_style: "Photography style",
  subject: "Brand subject",
  "identity.tagline": "Tagline",
  "identity.mission": "Mission",
  "identity.vision": "Vision",
  "identity.positioning": "Positioning",
  "identity.audience": "Audience",
  "identity.story": "Story",
  "messaging.elevator_pitch": "Elevator pitch",
  "messaging.boilerplate": "Boilerplate",
  "social.bio": "Social bio",
};

export interface BrandChange { path: string; label: string; value: string; current: string }
export interface AiBrandReply extends AiReply { note?: string; changes?: BrandChange[] }

function bookVal(book: BrandBook, path: string): string {
  const [a, b] = path.split(".");
  const sec = (book as Record<string, Record<string, unknown> | undefined>)[a];
  const v = sec?.[b];
  return typeof v === "string" ? v : Array.isArray(v) ? v.join(", ") : "";
}

/** Draft brand-book field values from a plain-English instruction (no writes). */
export async function aiBrandBookDraft(instruction: string): Promise<AiBrandReply> {
  const q = instruction.trim();
  if (!q) return { error: "Tell me what to fill in — e.g. “write my mission and a tagline”." };
  const { db, userId, ws } = await clientCtx();
  if (!ws) return { error: "Your brand workspace isn't set up yet." };
  const book = ws.brand_book ?? {};

  const currentOf = (path: string): string => {
    if (path.includes(".")) return bookVal(book, path);
    const v = (ws as unknown as Record<string, unknown>)[path];
    return typeof v === "string" ? v : "";
  };

  const facts = [
    `Brand: ${ws.name}`,
    ws.subject && `Makes: ${ws.subject}`,
    ws.voice_tone && `Current voice: ${ws.voice_tone}`,
    book.identity?.positioning && `Positioning: ${book.identity.positioning}`,
    book.identity?.story && `Story: ${book.identity.story}`,
    book.identity?.mission && `Mission: ${book.identity.mission}`,
  ].filter(Boolean).join("\n");

  const fieldList = Object.entries(COPILOT_FIELDS).map(([p, l]) => `- ${p}: ${l}`).join("\n");
  const system =
    "You help a brand OWNER fill in their brand book. Propose concise, on-brand values for ONLY these fields (use the exact path):\n" +
    fieldList +
    "\nRules: only propose fields relevant to the request; ground everything in the brand facts and never contradict them; keep each value tight (a phrase or 1–2 sentences; 'subject' is a short noun like 'the coffee'). " +
    "Return ONLY minified JSON, no prose: {\"note\":\"one friendly sentence to the owner\",\"changes\":[{\"path\":\"identity.tagline\",\"value\":\"...\"}]}";

  try {
    const res = await runClientAi({ db, userId, workspaceId: ws.id, purpose: "client_brandbook", system, user: `Brand facts:\n${facts}\n\nRequest: ${q}`, maxTokens: 700 });
    const json = res.text.slice(res.text.indexOf("{"), res.text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json) as { note?: string; changes?: { path: string; value: string }[] };
    const changes: BrandChange[] = (parsed.changes ?? [])
      .filter((c) => c && COPILOT_FIELDS[c.path] && typeof c.value === "string" && c.value.trim())
      .map((c) => ({ path: c.path, label: COPILOT_FIELDS[c.path], value: c.value.trim(), current: currentOf(c.path) }));
    if (changes.length === 0) return { text: parsed.note || "I couldn't find anything to fill for that — try being more specific.", budget: res.budget };
    return { text: parsed.note || "Here's what I'd suggest:", note: parsed.note, changes, budget: res.budget };
  } catch (e) {
    if (e instanceof BudgetError) return { error: e.message, overBudget: true };
    return { error: "I had trouble drafting that. Try rephrasing your request." };
  }
}

/** Concierge: answer any question grounded in the client's own brand + calendar. */
export async function aiConcierge(question: string, history: { role: "user" | "assistant"; text: string }[] = []): Promise<AiReply> {
  const q = question.trim();
  if (!q) return { error: "Ask me anything about your brand or your posts." };
  const { db, ws } = await clientCtx();
  if (!ws) return { error: "Your brand workspace isn't set up yet." };
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const now = new Date();
  const { data: cal } = await db.from("content_items")
    .select("title, stage, planned_date, format, objective")
    .not("planned_date", "is", null).gte("planned_date", iso(now)).order("planned_date").limit(15);
  const upcoming = ((cal as Pick<ContentItem, "title" | "stage" | "planned_date" | "format" | "objective">[]) ?? [])
    .map((p) => `${p.planned_date} — "${p.title}" (${p.format}, ${p.stage})`).join("\n") || "Nothing scheduled yet.";
  const convo = history.slice(-6).map((h) => `${h.role === "user" ? "Client" : "You"}: ${h.text}`).join("\n");
  const ctx = [
    brandBrief(ws),
    `\nUpcoming posts:\n${upcoming}`,
    convo && `\nConversation so far:\n${convo}`,
    `\nClient asks: ${q}`,
  ].filter(Boolean).join("\n");
  return run("client_concierge",
    VOICE + " Answer the client's question using ONLY the brand and calendar info provided. If you don't have the answer, say so and suggest they message their account manager. Keep it to a few sentences.",
    ctx, 450);
}
