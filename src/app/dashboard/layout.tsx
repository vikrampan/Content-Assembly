import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { RoleBadge } from "@/components/RoleBadge";
import { signOut } from "@/app/login/actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, role, email } = await requireSession();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-black/10 bg-[var(--background)]/80 backdrop-blur dark:border-white/10">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <div className="text-sm font-semibold tracking-tight">
            <span className="text-amber-700 dark:text-amber-400">◆</span>{" "}
            Content Assembly Line
          </div>
          <nav className="ml-4 flex items-center gap-1 text-sm">
            <Link
              href="/dashboard"
              className="rounded-lg px-2.5 py-1 transition hover:bg-black/5 dark:hover:bg-white/5"
            >
              Board
            </Link>
            {role !== "client" ? (
              <>
                <Link
                  href="/dashboard/portals"
                  className="rounded-lg px-2.5 py-1 transition hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Desks
                </Link>
                <Link
                  href="/dashboard/calendar"
                  className="rounded-lg px-2.5 py-1 transition hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Calendar
                </Link>
                <Link
                  href="/dashboard/strategy"
                  className="rounded-lg px-2.5 py-1 transition hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Strategy Desk
                </Link>
                <Link
                  href="/dashboard/library"
                  className="rounded-lg px-2.5 py-1 transition hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Library
                </Link>
                <Link
                  href="/dashboard/personas"
                  className="rounded-lg px-2.5 py-1 transition hover:bg-black/5 dark:hover:bg-white/5"
                >
                  AI Personas
                </Link>
              </>
            ) : null}
            {role === "admin" ? (
              <>
                <Link
                  href="/dashboard/brands"
                  className="rounded-lg px-2.5 py-1 transition hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Brands
                </Link>
                <Link
                  href="/dashboard/team"
                  className="rounded-lg px-2.5 py-1 transition hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Team &amp; Access
                </Link>
                <Link
                  href="/dashboard/ai"
                  className="rounded-lg px-2.5 py-1 transition hover:bg-black/5 dark:hover:bg-white/5"
                >
                  AI
                </Link>
              </>
            ) : null}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <RoleBadge role={role} />
            <span className="hidden text-sm opacity-60 sm:inline">
              {profile.full_name ?? email}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-black/15 px-2.5 py-1 text-xs transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
