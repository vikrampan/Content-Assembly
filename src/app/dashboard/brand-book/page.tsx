import { requireAccess } from "@/lib/auth";
import { BrandBookView } from "../client/BrandBookView";

export default async function BrandBookPage() {
  await requireAccess("brandbook");
  return <BrandBookView />;
}
