import { createAdminClient } from "@/lib/supabase/admin";

export async function getPublishedTutorTimeAdjustment(
  studentId: string,
): Promise<number | null> {
  const supabaseAdmin = createAdminClient();

  const [
    { data: directConnections, error: directError },
    { data: memberships, error: membershipError },
  ] = await Promise.all([
    supabaseAdmin
      .from("tutor_students")
      .select("tutor_id")
      .eq("student_id", studentId)
      .eq("status", "active"),
    supabaseAdmin
      .from("class_members")
      .select("class_id")
      .eq("student_id", studentId),
  ]);

  if (directError) {
    throw directError;
  }

  if (membershipError) {
    throw membershipError;
  }

  const classIds = (memberships ?? []).map((membership) => membership.class_id);
  let classTutorIds: string[] = [];

  if (classIds.length > 0) {
    const { data: classes, error: classesError } = await supabaseAdmin
      .from("classes")
      .select("tutor_id")
      .in("id", classIds)
      .eq("is_active", true);

    if (classesError) {
      throw classesError;
    }

    classTutorIds = (classes ?? []).map((item) => item.tutor_id);
  }

  const tutorIds = [
    ...new Set([
      ...(directConnections ?? []).map((item) => item.tutor_id),
      ...classTutorIds,
    ]),
  ];

  if (tutorIds.length === 0) {
    return null;
  }

  const { data: adjustmentRow, error: adjustmentError } = await supabaseAdmin
    .from("tutor_student_progress_overrides")
    .select("time_adjustment_hours")
    .eq("student_id", studentId)
    .in("tutor_id", tutorIds)
    .neq("time_adjustment_hours", 0)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (adjustmentError) {
    throw adjustmentError;
  }

  return adjustmentRow?.time_adjustment_hours ?? null;
}