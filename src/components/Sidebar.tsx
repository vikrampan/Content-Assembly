"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/app/login/actions";

export interface NavEntry {
  href: string;
  label: string;
  badge?: number;
}

// Line icons keyed by nav label. One consistent 24px stroke set.
function Icon({ label }: { label: string }) {
  const p = (() => {
    switch (label) {
      case "Dashboard":
        return <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>;
      case "Brand Books":
        return <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19a2 2 0 0 1 2-2h13" /></>;
      case "Calendar":
        return <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>;
      case "Strategy Desk":
        return <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="1" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></>;
      case "Media Library":
        return <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></>;
      case "AI Personas":
      case "AI":
        return <><path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1 0 8v1a4 4 0 0 1-8 0v-1a4 4 0 0 1 0-8V6a4 4 0 0 1 4-4Z" /><path d="M12 6v12" /></>;
      case "Desks":
        return <><path d="M3 21h18M4 21V8l8-5 8 5v13M9 21v-6h6v6" /></>;
      case "Team & Access":
        return <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6" /></>;
      case "My Desk":
        return <><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M8 21h8M12 18v3" /></>;
      case "Home":
        return <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>;
      case "Approvals":
        return <><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></>;
      case "Analytics":
        return <><path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3" /></>;
      case "Brand Book":
        return <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19a2 2 0 0 1 2-2h13" /></>;
      default:
        return <><circle cx="12" cy="12" r="9" /></>;
    }
  })();
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {p}
    </svg>
  );
}

export function Sidebar({
  nav,
  brandName,
  logoUrl,
  userName,
  role,
  initials,
}: {
  nav: NavEntry[];
  brandName: string;
  logoUrl?: string | null;
  userName: string;
  role: string;
  initials: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <>
      {/* Mobile hamburger — sits in the flow above content on small screens */}
      <button
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-30 grid h-10 w-10 place-items-center rounded-xl md:hidden"
        style={{ background: "var(--panel)", border: "1px solid var(--line)", color: "var(--muted)" }}
        aria-label="Open menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>

      {open ? <div className="side-scrim md:hidden" onClick={() => setOpen(false)} /> : null}

      <aside className={`side ${open ? "open" : ""}`}>
        <div className="side-brand">
          {logoUrl ? (
            <span className="side-mark" style={{ background: "#fff", padding: 5 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={brandName} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            </span>
          ) : (
            <span className="side-mark">M</span>
          )}
          <div>
            <div style={{ fontFamily: "var(--serif)", fontSize: "1.05rem", fontWeight: 700, lineHeight: 1.1 }}>{logoUrl ? brandName : "Mendly OS"}</div>
            <div style={{ fontSize: ".66rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--side-muted)" }}>{logoUrl ? "Brand Portal" : brandName}</div>
          </div>
        </div>

        <nav className="side-nav">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`side-link ${isActive(item.href) ? "active" : ""}`}
            >
              <Icon label={item.label} />
              <span>{item.label}</span>
              {item.badge ? (
                <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold" style={{ background: "var(--accent)", color: "#fff" }}>{item.badge}</span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="side-foot">
          <div className="flex items-center gap-2.5">
            <span className="avatar">{initials}</span>
            <div className="min-w-0">
              <div style={{ fontSize: ".85rem", fontWeight: 600, color: "var(--side-ink)", lineHeight: 1.1 }} className="truncate">{userName}</div>
              <div style={{ fontSize: ".68rem", color: "var(--side-muted)" }} className="truncate">{role}</div>
            </div>
            <form action={signOut} className="ml-auto">
              <button
                type="submit"
                title="Sign out"
                className="grid h-8 w-8 place-items-center rounded-lg"
                style={{ color: "var(--side-muted)" }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
