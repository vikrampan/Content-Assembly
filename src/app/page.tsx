import { redirect } from "next/navigation";

// The middleware already gates auth; send everyone to the dashboard, which
// renders the right view for their role.
export default function Home() {
  redirect("/dashboard");
}
