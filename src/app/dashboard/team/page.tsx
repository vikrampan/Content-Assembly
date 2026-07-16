import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { RoleBadge } from "@/components/RoleBadge";
import type { AccountType, Membership, Profile, Workspace } from "@/lib/types";
import { CreateUserForm } from "./CreateUserForm";

export default async function TeamPage() {
  const session = await requireSession();
  if (session.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const { data: workspacesRaw } = await supabase
    .from("workspaces")
    .select("*")
    .order("name");
  const workspaces = (workspacesRaw as Workspace[]) ?? [];
  const wsName = new Map(workspaces.map((w) => [w.id, w.name]));

  const serviceReady = hasServiceRole();

  // Build the user roster (needs the service_role key for auth emails).
  let roster: {
    id: string;
    email: string;
    fullName: string | null;
    accountType: AccountType;
    memberships: { workspace: string; role: string }[];
  }[] = [];

  if (serviceReady) {
    const admin = createAdminClient();
    const [{ data: usersData }, { data: profiles }, { data: memberships }] =
      await Promise.all([
        admin.auth.admin.listUsers(),
        admin.from("profiles").select("*"),
        admin.from("memberships").select("*"),
      ]);

    const profileById = new Map(
      ((profiles as Profile[]) ?? []).map((p) => [p.id, p]),
    );
    const memsByUser = new Map<string, Membership[]>();
    for (const m of (memberships as Membership[]) ?? []) {
      const list = memsByUser.get(m.user_id) ?? [];
      list.push(m);
      memsByUser.set(m.user_id, list);
    }

    roster = (usersData?.users ?? []).map((u) => {
      const p = profileById.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "—",
        fullName: p?.full_name ?? null,
        accountType: (p?.account_type ?? "client") as AccountType,
        memberships: (memsByUser.get(u.id) ?? []).map((m) => ({
          workspace: wsName.get(m.workspace_id) ?? m.workspace_id,
          role: m.role,
        })),
      };
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Team &amp; Access</h1>
        <p className="text-sm opacity-60">
          Onboard users, set roles, and grant workspace access.
        </p>
      </div>

      {!serviceReady ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="font-medium">Service role key needed</div>
          <p className="mt-1 text-xs leading-relaxed opacity-90">
            Creating login accounts uses Supabase&apos;s Admin API, which requires
            the <code>service_role</code> key. Add it to <code>.env.local</code> as{" "}
            <code>SUPABASE_SERVICE_ROLE_KEY</code> (Dashboard → Project Settings →
            API Keys → <code>service_role</code>), then restart the dev server.
          </p>
        </div>
      ) : null}

      <CreateUserForm workspaces={workspaces} />

      {serviceReady ? (
        <div className="rounded-2xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
          <h2 className="mb-3 text-sm font-semibold">
            Users <span className="opacity-50">({roster.length})</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide opacity-55">
                  <th className="px-2 py-2 font-medium">User</th>
                  <th className="px-2 py-2 font-medium">Role</th>
                  <th className="px-2 py-2 font-medium">Workspaces</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-black/5 dark:border-white/5"
                  >
                    <td className="px-2 py-2.5">
                      <div className="font-medium">{u.fullName ?? "—"}</div>
                      <div className="text-xs opacity-55">{u.email}</div>
                    </td>
                    <td className="px-2 py-2.5">
                      <RoleBadge role={u.accountType} />
                    </td>
                    <td className="px-2 py-2.5">
                      {u.memberships.length === 0 ? (
                        <span className="text-xs opacity-45">
                          {u.accountType === "admin" ? "all (global)" : "none"}
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.memberships.map((m, i) => (
                            <span
                              key={i}
                              className="rounded-full border border-black/10 px-2 py-0.5 text-[11px] dark:border-white/10"
                            >
                              {m.workspace} · {m.role.replace("_", " ")}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
