import { TenseDetectorClient } from "@/components/tense-detector/tense-detector-client";
import { requireRole } from "@/lib/rbac/require-role";

export const dynamic = "force-dynamic";

export default async function TenseDetectorPage() {
  await requireRole("tutor");

  return <TenseDetectorClient />;
}
