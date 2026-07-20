import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { navFor, userFunction } from "@/lib/mendly/access";
import { Sidebar } from "@/components/Sidebar";

const FN_LABEL: Record<string, string> = {
  admin: "Agency Control",
  client: "Brand Portal",
  brand: "Brand Studio",
  capture: "Capture Desk",
  strategy: "Strategy Desk",
  content: "Content Desk",
  design: "Design Desk",
  video: "Video Desk",
  image: "Image Desk",
  audio: "Audio Desk",
  qa: "Quality Desk",
  social: "Social Desk",
};

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, email } = await requireSession();
  const fn = userFunction(profile);
  const nav = navFor(fn);
  const displayName = profile.full_name ?? email ?? "";

  // The sidebar subtitle: clients see their brand; staff see their desk label.
  let subtitle = FN_LABEL[fn] ?? "Workspace";
  let logoUrl: string | null = null;
  if (fn === "client") {
    const supabase = await createClient();
    const { data: ws } = await supabase.from("workspaces").select("name,logo_path").limit(1).maybeSingle<{ name: string; logo_path: string | null }>();
    if (ws?.name) subtitle = ws.name;
    if (ws?.logo_path) {
      const { data: signed } = await supabase.storage.from("assets").createSignedUrl(ws.logo_path, 3600);
      logoUrl = signed?.signedUrl ?? null;
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        nav={nav}
        brandName={subtitle}
        logoUrl={logoUrl}
        userName={displayName}
        role={FN_LABEL[fn] ?? fn}
        initials={initialsOf(displayName)}
      />
      <main className="min-w-0">
        <div className="mx-auto max-w-[1200px] px-[clamp(18px,4vw,36px)] py-[clamp(20px,3.5vw,32px)] pt-14 md:pt-[clamp(20px,3.5vw,32px)]">
          {children}
        </div>
      </main>
    </div>
  );
}
