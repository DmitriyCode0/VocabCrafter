import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StudentProgressMonthlyPage() {
  redirect("/progress?tab=monthly");
}
