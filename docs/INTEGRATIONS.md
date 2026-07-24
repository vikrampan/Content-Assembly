# Mendly OS — Integrations & activation checklist

Every integration is built behind a "seam": the feature works the moment its
key is present, and shows an honest "not connected" state otherwise. Set each
env var in **both** `.env.local` (local dev) and **Vercel → Project → Settings →
Environment Variables** (production), then redeploy.

The Admin **Cockpit → Integrations** panel shows live status of everything below.

---

## 1. Claude (Anthropic) — ✅ already connected
Powers all AI: brand import, month planning, copy/hooks, voice lint, media prompts.
- Env: `ANTHROPIC_API_KEY`
- Get it: https://console.anthropic.com → API Keys

## 2. Replicate — AI image/video generation
Turns on real generation in the Media desk (prompt is written by Claude already).
- Env: `REPLICATE_API_TOKEN` (optional: `REPLICATE_IMAGE_MODEL`, `REPLICATE_VIDEO_MODEL`)
- Get it: https://replicate.com/account/api-tokens
- Cost: pay-per-generation; keep "unlimited AI" to premium tiers to protect margin.

## 3. Resend — client & team emails
Turns on notification emails (review-ready, changes-requested).
- Env: `RESEND_API_KEY`, plus `RESEND_FROM` (a verified sender), `NOTIFY_TEAM_EMAIL`, `NEXT_PUBLIC_APP_URL`
- Get it: https://resend.com → API Keys, then **verify a sending domain** (the
  default `onboarding@resend.dev` only delivers to your own inbox).

## 4. Supabase service role — ✅ already connected
Admin user management (create brands + client logins, reset passwords) and
in-app notification inserts.
- Env: `SUPABASE_SERVICE_ROLE_KEY`
- Get it: Supabase → Project Settings → API → service_role (**secret — never ship to the browser**)

## 5. Meta (Instagram/Facebook) — publishing + analytics  *(connection layer in progress)*
One platform-level app + a per-brand "Connect" (OAuth). See the flow below.
- Env: `META_APP_ID`, `META_APP_SECRET`, `NEXT_PUBLIC_APP_URL`
- Setup:
  1. https://developers.facebook.com → Create App → **Business**.
  2. Add products: **Facebook Login for Business** + **Instagram Graph API**.
  3. Settings → Basic → copy **App ID** + **App Secret**.
  4. Facebook Login → Settings → Valid OAuth Redirect URIs:
     `https://<your-domain>/api/meta/callback` and `http://localhost:3000/api/meta/callback`
  5. Each brand connects its own account via the **Connect Instagram** button
     (admin, on the brand page). Requires the brand's IG to be a **Business/Creator
     account linked to a Facebook Page**.
  6. **App Review**: submit for `instagram_content_publish`, `pages_read_engagement`,
     `instagram_manage_insights` before it works for non-admin accounts. (Dev-mode
     testing works with your own connected accounts.)
- Note: the connection is **per brand** (each brand's own token, stored in
  `meta_connections`), but the **app is one** (platform-level).

---

## Security TODO (owner action)
- 🔴 **Rotate** the keys that were shared in chat during development (Anthropic,
  Supabase service_role, Supabase access token) from their respective dashboards.
- Store provider secrets in the admin key vault (encrypted) rather than plain env
  as the key-governance layer lands.
