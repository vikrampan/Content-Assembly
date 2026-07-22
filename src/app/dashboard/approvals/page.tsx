import { requireAccess } from "@/lib/auth";
import { ApprovalsView } from "../client/ApprovalsView";

export default async function ApprovalsPage() {
  await requireAccess("approvals");
  return <ApprovalsView />;
}
