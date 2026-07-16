"use client";

import { useState, useTransition } from "react";
import type { AccountType, Workspace } from "@/lib/types";
import { DEPARTMENTS } from "@/lib/mendly/departments";
import { createUser } from "./actions";

const ROLE_OPTIONS: { value: AccountType; label: string; hint: string }[] = [
  { value: "team_incharge", label: "Team Incharge", hint: "Executes the pipeline on assigned workspaces" },
  { value: "client", label: "Client", hint: "Reviews & approves their own workspace only" },
  { value: "admin", label: "Admin", hint: "Global access — no workspace needed" },
];

function randomPassword() {
  // Readable-ish strong default the admin can share, then the user can change.
  const part = () => Math.random().toString(36).slice(2, 6);
  return `Ps-${part()}-${part()}${Math.floor(Math.random() * 90 + 10)}`;
}

export function CreateUserForm({ workspaces }: { workspaces: Workspace[] }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(randomPassword());
  const [accountType, setAccountType] = useState<AccountType>("team_incharge");
  const [department, setDepartment] = useState("content");
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [feedback, setFeedback] = useState<
    { kind: "ok" | "err"; text: string } | null
  >(null);
  const [pending, startTransition] = useTransition();

  const needsWorkspace = accountType !== "admin";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await createUser({
        fullName,
        email,
        password,
        accountType,
        workspaceId: needsWorkspace ? workspaceId : null,
        department: accountType === "team_incharge" ? department : null,
      });
      if ("error" in res) {
        setFeedback({ kind: "err", text: res.error });
      } else {
        setFeedback({
          kind: "ok",
          text: `${res.message ?? "User created."} Password: ${password}`,
        });
        // Reset for the next user; keep role + workspace for fast bulk onboarding.
        setFullName("");
        setEmail("");
        setPassword(randomPassword());
      }
    });
  }

  const inputCls =
    "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-white/15 dark:bg-white/5";

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5"
    >
      <h2 className="text-sm font-semibold">Onboard a user</h2>
      <p className="mb-4 mt-0.5 text-xs opacity-60">
        Creates the login, sets the role, and grants workspace access in one step.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="mb-1 block opacity-70">Full name</span>
          <input
            className={inputCls}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Creator"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block opacity-70">Email</span>
          <input
            className={inputCls}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@agency.com"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block opacity-70">Temporary password</span>
          <input
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block opacity-70">Role</span>
          <select
            className={inputCls}
            value={accountType}
            onChange={(e) => setAccountType(e.target.value as AccountType)}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        {accountType === "team_incharge" ? (
          <label className="block text-xs">
            <span className="mb-1 block opacity-70">Department (desk)</span>
            <select
              className={inputCls}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </select>
          </label>
        ) : null}
        {needsWorkspace ? (
          <label className="block text-xs sm:col-span-2">
            <span className="mb-1 block opacity-70">Workspace</span>
            <select
              className={inputCls}
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              required
            >
              {workspaces.length === 0 ? (
                <option value="">No workspaces yet</option>
              ) : (
                workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))
              )}
            </select>
          </label>
        ) : (
          <p className="text-xs opacity-55 sm:col-span-2">
            Admins have global access — no workspace assignment needed.
          </p>
        )}
      </div>

      {feedback ? (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-xs ${
            feedback.kind === "ok"
              ? "border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border border-red-300 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending || (needsWorkspace && !workspaceId)}
        className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create user"}
      </button>
    </form>
  );
}
