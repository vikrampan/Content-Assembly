import { requireAccess } from "@/lib/auth";
import { PlanView } from "../client/PlanView";

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireAccess("plan");
  const { m } = await searchParams;
  return <PlanView month={m} />;
}
