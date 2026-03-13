import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  fetchHistoryPageData,
  HISTORY_PAGE_SIZE,
} from "@/lib/history/fetch-history-page-data";
import type { Role } from "@/types/roles";
import { HistoryClient } from "@/components/history/history-client";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const { student: studentFilter } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const role = profile.role as Role;
  const { attempts, hasMore, students, activeStudentFilter } =
    await fetchHistoryPageData({
      role,
      userId: user.id,
      limit: HISTORY_PAGE_SIZE,
      studentId: studentFilter,
    });

  return (
    <HistoryClient
      role={role}
      initialAttempts={attempts}
      initialHasMore={hasMore}
      students={students}
      userId={user.id}
      initialStudentFilter={activeStudentFilter ?? undefined}
    />
  );
}
