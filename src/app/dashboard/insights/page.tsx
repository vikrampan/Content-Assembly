import { requireAccess } from "@/lib/auth";
import { InsightsView } from "../client/InsightsView";

export default async function InsightsPage() {
  await requireAccess("insights");
  return <InsightsView />;
}
