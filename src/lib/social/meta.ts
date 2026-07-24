// ===========================================================================
// Meta (Instagram / Facebook) Graph API — the per-brand connection + publish.
//
// One platform-level app (META_APP_ID / META_APP_SECRET). Each brand connects
// its own account via OAuth; we store a long-lived Page token per workspace.
// Gated on the app credentials — no app configured → everything no-ops.
// ===========================================================================

const GRAPH = "https://graph.facebook.com/v21.0";
const OAUTH_DIALOG = "https://www.facebook.com/v21.0/dialog/oauth";

const SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
].join(",");

export function hasMetaApp(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export function redirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/meta/callback`;
}

/** The OAuth consent URL a brand opens to authorize the app. `state` = workspace id. */
export function metaAuthUrl(workspaceId: string): string {
  const p = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: redirectUri(),
    state: workspaceId,
    scope: SCOPES,
    response_type: "code",
  });
  return `${OAUTH_DIALOG}?${p.toString()}`;
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url);
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error((json.error as { message?: string } | undefined)?.message ?? `Meta ${res.status}`);
  return json;
}

/** Exchange the OAuth code → a long-lived user access token. */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const short = await getJson(`${GRAPH}/oauth/access_token?client_id=${process.env.META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri())}&client_secret=${process.env.META_APP_SECRET}&code=${encodeURIComponent(code)}`);
  const long = await getJson(`${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${short.access_token}`);
  return String(long.access_token);
}

export interface DiscoveredConnection { page_id: string; page_name: string | null; ig_user_id: string | null; access_token: string; }

/** Find the brand's first Page that has an Instagram Business account. */
export async function discoverConnection(userToken: string): Promise<DiscoveredConnection | null> {
  const pages = await getJson(`${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${userToken}`);
  const list = (pages.data as { id: string; name: string; access_token: string; instagram_business_account?: { id: string } }[]) ?? [];
  const withIg = list.find((p) => p.instagram_business_account) ?? list[0];
  if (!withIg) return null;
  return {
    page_id: withIg.id,
    page_name: withIg.name ?? null,
    ig_user_id: withIg.instagram_business_account?.id ?? null,
    access_token: withIg.access_token, // page token (long-lived, inherits user token longevity)
  };
}

export interface PublishOk { ok: true; externalId: string }
export interface PublishErr { ok: false; error: string }

/** Publish an image post to the brand's Instagram Business account. */
export async function publishInstagram(conn: { ig_user_id: string | null; access_token: string }, caption: string, imageUrl: string): Promise<PublishOk | PublishErr> {
  if (!conn.ig_user_id) return { ok: false, error: "No Instagram Business account linked to this brand's page." };
  try {
    // 1) create media container (Meta fetches image_url server-side)
    const container = await getJson(`${GRAPH}/${conn.ig_user_id}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${conn.access_token}`);
    // 2) publish it
    const published = await getJson(`${GRAPH}/${conn.ig_user_id}/media_publish?creation_id=${container.id}&access_token=${conn.access_token}`);
    return { ok: true, externalId: String(published.id) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Publish failed." };
  }
}

/** Pull insights for a published IG media object. */
export async function mediaInsights(conn: { access_token: string }, mediaId: string): Promise<Record<string, number>> {
  try {
    const json = await getJson(`${GRAPH}/${mediaId}/insights?metric=reach,impressions,likes,comments,saved&access_token=${conn.access_token}`);
    const out: Record<string, number> = {};
    for (const m of (json.data as { name: string; values: { value: number }[] }[]) ?? []) out[m.name] = m.values?.[0]?.value ?? 0;
    return out;
  } catch { return {}; }
}
