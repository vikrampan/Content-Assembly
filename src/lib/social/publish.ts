// ===========================================================================
// Social publishing — the Meta seam + best-time heuristics.
//
// Real auto-publish needs a Meta connection (Graph API), which lands with the
// Admin key-governance phase. Until then hasMeta() is false and the Social desk
// marks posts live manually. The publish() shape is ready for the real call.
// ===========================================================================

export function hasMeta(): boolean {
  return Boolean(process.env.META_ACCESS_TOKEN);
}

export interface PublishResult { ok: boolean; externalId?: string; error?: string }

/**
 * Publish a post to a platform. Wired for Meta; returns not-connected until a
 * token is present so the caller falls back to manual "mark published".
 */
export async function publish(_platform: string, _body: string): Promise<PublishResult> {
  if (!hasMeta()) return { ok: false, error: "not_connected" };
  // Real Graph API publish lands with the Meta integration (Admin phase).
  return { ok: false, error: "not_connected" };
}
