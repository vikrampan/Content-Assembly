import type { AccountType } from "@/lib/types";

const STYLES: Record<AccountType, { label: string; className: string }> = {
  admin: {
    label: "Admin",
    className:
      "bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300",
  },
  team_incharge: {
    label: "Team Incharge",
    className:
      "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  },
  client: {
    label: "Client",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  },
};

export function RoleBadge({ role }: { role: AccountType }) {
  const s = STYLES[role];
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}
    >
      {s.label}
    </span>
  );
}
