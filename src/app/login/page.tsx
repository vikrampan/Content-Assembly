import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10" style={{ background: "var(--bg)" }}>
      {/* Ambient brand glow */}
      <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle, var(--accent), transparent 70%)" }} />

      <div className="relative w-full max-w-sm">
        {/* Brand mark */}
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl font-bold text-white" style={{ background: "linear-gradient(135deg, #c8853f, #7a4d24)", fontFamily: "var(--serif)" }}>M</span>
          <div>
            <div className="text-sm font-bold leading-tight">Mendly OS</div>
            <div className="text-[11px] uppercase tracking-widest" style={{ color: "var(--faint)" }}>Content platform</div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="h-1.5" style={{ background: "var(--accent)" }} />
          <div className="p-7">
            <h1 className="text-2xl font-bold" style={{ letterSpacing: "-.01em" }}>Welcome back</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>Sign in to your workspace.</p>

            <div className="mt-6">
              <LoginForm error={error} />
            </div>
          </div>
        </div>

        <p className="mt-5 px-2 text-center text-xs" style={{ color: "var(--faint)" }}>
          Accounts are provisioned by your agency admin.<br />Trouble signing in? Contact your account manager.
        </p>
      </div>
    </main>
  );
}
