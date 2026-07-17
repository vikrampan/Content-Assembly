// ===========================================================================
// Transactional email via Resend (server-only).
//
// Fully wired but gated on RESEND_API_KEY — if the key is absent every call is
// a safe no-op that logs what it *would* have sent, so the pipeline never
// blocks. Add RESEND_API_KEY (+ optional RESEND_FROM, NOTIFY_TEAM_EMAIL) to
// activate. Recipient lookups use the service-role Auth Admin API.
// ===========================================================================

import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

const FROM = process.env.RESEND_FROM || "Mendly OS <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://content-assembly.vercel.app";

export function hasResend(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

interface Mail {
  to: string;
  subject: string;
  heading: string;
  body: string;
  cta?: { label: string; href: string };
}

function render({ heading, body, cta }: Mail): string {
  return `<!doctype html><html><body style="margin:0;background:#f1ede6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:32px">
  <div style="max-width:520px;margin:0 auto;background:#fbf9f5;border:1px solid #e5dbcc;border-radius:16px;overflow:hidden">
    <div style="height:6px;background:#c8853f"></div>
    <div style="padding:28px 30px">
      <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#9a8c7b;font-weight:700">Mendly OS</div>
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:8px 0 12px;color:#241c15">${heading}</h1>
      <p style="font-size:15px;line-height:1.6;color:#6e6154;margin:0 0 22px">${body}</p>
      ${cta ? `<a href="${cta.href}" style="display:inline-block;background:#c8853f;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:10px">${cta.label}</a>` : ""}
    </div>
  </div>
  <p style="text-align:center;color:#9a8c7b;font-size:11px;margin-top:18px">Sent by Mendly OS</p>
</body></html>`;
}

async function send(mail: Mail): Promise<void> {
  if (!hasResend()) {
    console.log(`[email:noop] → ${mail.to} — "${mail.subject}" (set RESEND_API_KEY to send)`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: mail.to,
        subject: mail.subject,
        html: render(mail),
      }),
    });
    if (!res.ok) console.error(`[email] Resend ${res.status}: ${await res.text()}`);
  } catch (e) {
    console.error("[email] send failed:", e);
  }
}

/** The client owner's email for a workspace (via membership + Auth Admin). */
async function clientEmailForWorkspace(workspaceId: string): Promise<string | null> {
  if (!hasServiceRole()) return null;
  try {
    const admin = createAdminClient();
    const { data: mem } = await admin
      .from("memberships")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .eq("role", "client")
      .limit(1)
      .maybeSingle();
    const userId = (mem as { user_id: string } | null)?.user_id;
    if (!userId) return null;
    const { data } = await admin.auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  } catch (e) {
    console.error("[email] client lookup failed:", e);
    return null;
  }
}

/** Notify the client that a post is ready for their sign-off. */
export async function notifyClientReviewReady(workspaceId: string, itemTitle: string): Promise<void> {
  const to = await clientEmailForWorkspace(workspaceId);
  if (!to) {
    console.log(`[email:skip] no client email for workspace ${workspaceId}`);
    return;
  }
  await send({
    to,
    subject: "A new post is ready for your approval",
    heading: "Ready for your review",
    body: `Your team just sent <b>“${itemTitle}”</b> through QA. Open your portal to approve it or request changes.`,
    cta: { label: "Review in your portal", href: `${APP_URL}/dashboard` },
  });
}

/** Notify the team that the client requested changes. */
export async function notifyChangesRequested(itemTitle: string, note: string): Promise<void> {
  const to = process.env.NOTIFY_TEAM_EMAIL;
  if (!to) {
    console.log(`[email:skip] NOTIFY_TEAM_EMAIL not set — changes requested on "${itemTitle}"`);
    return;
  }
  await send({
    to,
    subject: `Client requested changes: ${itemTitle}`,
    heading: "Client requested changes",
    body: `The client asked for changes on <b>“${itemTitle}”</b>.<br/><br/><i>“${note}”</i>`,
    cta: { label: "Open the board", href: `${APP_URL}/dashboard` },
  });
}
