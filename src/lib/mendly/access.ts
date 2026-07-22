// ===========================================================================
// Access model — who sees what.
//
// Every user resolves to a single FUNCTION. Admin sees everything; each staff
// function gets one focused home + a scoped set of tools; clients see only
// their review/approval surface. Pure (no next/navigation) so it's importable
// anywhere; the server guards in lib/auth.ts use these maps.
// ===========================================================================

import type { Profile } from "@/lib/types";

export type Fn =
  | "admin" | "client"
  | "brand" | "capture" | "strategy" | "content"
  | "design" | "video" | "image" | "audio" | "qa" | "social";

export function userFunction(p: Pick<Profile, "account_type" | "department">): Fn {
  if (p.account_type === "admin") return "admin";
  if (p.account_type === "client") return "client";
  return (p.department as Fn) || "content";
}

export interface NavItem { href: string; label: string }

const NAV: Record<string, NavItem> = {
  board: { href: "/dashboard", label: "Dashboard" },
  brands: { href: "/dashboard/brands", label: "Brand Books" },
  calendar: { href: "/dashboard/calendar", label: "Calendar" },
  strategy: { href: "/dashboard/strategy", label: "Strategy Desk" },
  library: { href: "/dashboard/library", label: "Media Library" },
  personas: { href: "/dashboard/personas", label: "AI Personas" },
  portals: { href: "/dashboard/portals", label: "Desks" },
  team: { href: "/dashboard/team", label: "Team & Access" },
  ai: { href: "/dashboard/ai", label: "AI" },
  // Client portal sections
  chome: { href: "/dashboard", label: "Home" },
  capprovals: { href: "/dashboard/approvals", label: "Approvals" },
  cplan: { href: "/dashboard/plan", label: "Calendar" },
  cinsights: { href: "/dashboard/insights", label: "Analytics" },
  cbrandbook: { href: "/dashboard/brand-book", label: "Brand Book" },
};

// The nav keys each function may see. "mydesk" resolves to /dashboard/desk/<fn>.
const NAV_FOR: Record<Fn, string[]> = {
  admin: ["board", "brands", "calendar", "strategy", "library", "personas", "portals", "team", "ai"],
  strategy: ["board", "calendar", "strategy", "personas"],
  client: ["chome", "capprovals", "cplan", "cinsights", "cbrandbook"],
  brand: ["brands"],
  capture: ["library"],
  content: ["mydesk", "strategy"],
  design: ["mydesk", "library"],
  video: ["mydesk", "library"],
  image: ["mydesk", "library"],
  audio: ["mydesk", "library"],
  qa: ["mydesk"],
  social: ["mydesk"],
};

// Which functions may open each guarded route.
const ROUTE_ALLOW: Record<string, Fn[]> = {
  board: ["admin", "strategy", "client"],
  brands: ["admin", "brand"],
  calendar: ["admin", "strategy"],
  strategy: ["admin", "strategy", "content"],
  library: ["admin", "capture", "design", "video", "image", "audio"],
  personas: ["admin", "strategy", "content"],
  portals: ["admin"],
  team: ["admin"],
  ai: ["admin"],
  // Client-only portal sections
  approvals: ["client"],
  plan: ["client"],
  insights: ["client"],
  brandbook: ["client"],
  // any internal staff may open a content item they're working on
  content_detail: ["admin", "strategy", "content", "design", "video", "image", "audio", "qa", "social"],
};

/** The landing page for a function after login. */
export function homeFor(fn: Fn): string {
  switch (fn) {
    case "admin":
    case "strategy":
    case "client":
      return "/dashboard";
    case "brand":
      return "/dashboard/brands";
    case "capture":
      return "/dashboard/library";
    default:
      return `/dashboard/desk/${fn}`;
  }
}

export function routeAllowed(fn: Fn, routeKey: string): boolean {
  const allow = ROUTE_ALLOW[routeKey];
  return allow ? allow.includes(fn) : true;
}

/** Nav items to render for this function (mydesk expanded to their desk). */
export function navFor(fn: Fn): NavItem[] {
  return NAV_FOR[fn].map((k) =>
    k === "mydesk" ? { href: `/dashboard/desk/${fn}`, label: "My Desk" } : NAV[k],
  );
}
