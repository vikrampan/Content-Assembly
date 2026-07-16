import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Workspace } from "@/lib/types";
import { BrandBookForm } from "./BrandBookForm";

export default async function BrandEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAccess("brands");

  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("workspaces").select("*").eq("id", id).single<Workspace>();
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/brands" className="text-xs opacity-60 hover:underline">
          ← Brand Books
        </Link>
        <h1 className="mt-1 text-lg font-semibold">{data.name} — Brand Book</h1>
        <p className="text-sm opacity-60">
          The constitution. Locked here, obeyed everywhere — copy desk, AI prompts, and the QA firewall.
        </p>
      </div>
      <BrandBookForm brand={data} />
    </div>
  );
}
