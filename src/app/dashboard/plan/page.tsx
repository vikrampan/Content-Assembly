import { requireAccess } from "@/lib/auth";
import { PlanView } from "../client/PlanView";

export default async function PlanPage() {
  await requireAccess("plan");
  return <PlanView />;
}
