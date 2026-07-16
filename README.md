# Content Assembly Line

An automated assembly line for social media content — the **4-Layer SOP**,
digitized. Content is researched, crafted, approved, and deployed in one
streamlined, role-aware environment instead of scattered email + WhatsApp
threads.

> **Status: Round 1 — Core Foundation.** This scaffold ships the spine:
> the data model, database-enforced role isolation (RLS), auth + role routing,
> per-client workspace isolation, and the Kanban board shell for all three
> roles. The four content modules (Fact Vault, Copywriting Matrix, Asset Studio
> + AI, Assembly/QA) build on top of this in later rounds.

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind v4 | Component-driven UI, server components |
| Backend / DB | Supabase (Postgres) | Relational, first-class **Row-Level Security** |
| Auth | Supabase Auth (email + password) | Sessions via cookies, works with SSR |
| Realtime | Supabase Realtime | Live comments without refresh (wired in a later round) |
| Storage | Supabase Storage (`assets` bucket) | Scalable buckets for 8k images / video |
| AI images | Pluggable adapter (`stub` today) | Brand-rule injection is real; provider call is stubbed |

## The three roles

| Role | Sees | Can do |
| --- | --- | --- |
| **Admin** | Everything, every workspace | Create workspaces, lock Brand Books, assign team, onboard users, final internal gate |
| **Team Incharge** | Only **assigned** workspaces (incl. WIP) | Execute the pipeline, prompt AI, upload comps, flag for review |
| **Client** | Only **their** workspace, only client-visible stages | Approve, request changes, upload raw assets |

### How isolation is guaranteed (defense in depth)

- Every tenant row carries a `workspace_id`.
- A `memberships` table maps each user to the workspaces (and role) they may access.
- **RLS is the boundary, not the UI.** Policies key off `SECURITY DEFINER`
  helper functions (`is_admin()`, `is_member_of()`, `is_team_member_of()`,
  `is_client_of()`), so even a hand-crafted API request cannot return another
  client's rows — or a client's own work-in-progress drafts.
- Clients see only `ready_for_client_review`, `changes_requested`, `approved`,
  `scheduled`, `published`, plus `ideation` items explicitly `shared_with_client`.
- Internal comments (`internal = true`) are invisible to clients.

See [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project & apply the schema

Either use the hosted dashboard or the Supabase CLI.

**With the CLI (recommended):**

```bash
npm i -g supabase          # if not already installed
supabase init              # once, if you don't have a supabase/config.toml
supabase start             # local stack (Docker), or `supabase link` a hosted project
supabase db reset          # applies migrations in supabase/migrations + seed.sql
```

**Or paste manually:** run the contents of
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql),
then [`0002_storage.sql`](supabase/migrations/0002_storage.sql), then
[`supabase/seed.sql`](supabase/seed.sql) in the SQL editor.

### 3. Configure environment

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from
**Project Settings → API**. Leave the AI keys blank (stub mode).

### 4. Generate real DB types (optional but recommended)

```bash
npm run types:gen   # overwrites src/lib/supabase/database.types.ts
```

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`.

## Provisioning users

Auth users are created in Supabase, then given a role + membership. New signups
default to `account_type = 'client'` with **no** membership, so they see nothing
until an Admin assigns them.

1. **Authentication → Users → Add user** (create admin, a creator, a client).
2. In the SQL editor, set roles + memberships (see the commented block at the
   bottom of [`supabase/seed.sql`](supabase/seed.sql)). Example:

```sql
update public.profiles set account_type = 'admin' where id = '<admin-uuid>';

update public.profiles set account_type = 'team_incharge' where id = '<creator-uuid>';
insert into public.memberships (workspace_id, user_id, role)
values ('00000000-0000-0000-0000-000000000001', '<creator-uuid>', 'team_incharge');

update public.profiles set account_type = 'client' where id = '<client-uuid>';
insert into public.memberships (workspace_id, user_id, role)
values ('00000000-0000-0000-0000-000000000001', '<client-uuid>', 'client');
```

3. Sign in as each to verify: the **client only sees the Puresol board** with
   Pending/Approved items (never the WIP drafts); the **team incharge** sees the
   full 4-layer pipeline; the **admin** sees the control room across all workspaces.

## Project structure

```
supabase/
  migrations/0001_init.sql     schema + all RLS policies + helper functions
  migrations/0002_storage.sql  assets bucket + storage RLS
  seed.sql                     Puresol demo data (workspace, facts, pipeline)
src/
  app/
    login/                     email+password auth (server actions)
    auth/callback/route.ts     OAuth / magic-link exchange
    dashboard/                 role-aware layout + board
    page.tsx                   → redirects to /dashboard
  components/
    KanbanBoard.tsx            board shell (columns + cards)
    RoleBadge.tsx
  lib/
    supabase/{client,server,middleware}.ts   SSR-safe Supabase clients
    auth.ts                    requireSession(): role + memberships
    pipeline.ts                stages + per-role column mapping
    types.ts                   domain types (mirror the SQL enums)
    ai/image-adapter.ts        Module 3 seam — brand-rule injection (real) + stub call
middleware.ts                  session refresh + route protection
```

## Roadmap

**Done**

- ✅ **Drag-and-drop stage transitions** — team/admin drag cards across the
  pipeline; each column is a single status so the target stage is unambiguous.
  Optimistic UI, reverts on error. (`src/components/KanbanBoard.tsx`,
  `moveStage` in `src/app/dashboard/actions.ts`.)
- ✅ **Client approve / request-changes** — column-restricted `SECURITY DEFINER`
  RPC `client_review_content` (`supabase/migrations/0003_content_transitions.sql`).
  A client can only flip `ready_for_client_review` → `approved` /
  `changes_requested`, only on their own workspace's items, and a rejection
  requires a comment (attached as a non-internal comment for the team).

**Next rounds**

1. **Module 1 — Fact & Asset Vault:** toggle facts into a post's brief.
2. **Module 2 — Copywriting Matrix:** Hook / Educational Shift / Solution editor with counters + claim checklist.
3. **Module 3 — Asset Studio:** wire a real image provider behind the adapter; brand rules already auto-append.
4. **Module 4 — Assembly & QA:** drag-drop staging + Brand Compliance Checklist gating "Submit for Admin Review".
5. **Realtime comment threads** — the `comments` table + RLS are ready; wire Supabase Realtime for live updates.
6. **Admin management screens** — create workspaces, lock Brand Books, assign team (replacing manual SQL provisioning).
```
