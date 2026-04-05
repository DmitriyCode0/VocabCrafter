import { createAdminClient } from "@/lib/supabase/admin";
import {
  EMPTY_TUTOR_PROGRESS_OVERRIDE,
  parseTutorProgressOverride,
  type TutorProgressOverride,
} from "@/lib/progress/contracts";

export interface PublishedTutorProgressOverride {
  tutorName: string | null;
  updatedAt: string;
  override: TutorProgressOverride;
}

export async function getPublishedTutorProgressOverride(
  studentId: string,
): Promise<PublishedTutorProgressOverride | null> {
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

  const { data: overrideRow, error: overrideError } = await supabaseAdmin
    .from("tutor_student_progress_overrides")
    .select("tutor_id, axis_overrides, insights_override, updated_at")
    .eq("student_id", studentId)
    .in("tutor_id", tutorIds)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (overrideError) {
    throw overrideError;
  }

  if (!overrideRow) {
    return null;
  }

  const parsedOverride = parseTutorProgressOverride(overrideRow);
  const hasContent =
    parsedOverride.axisOverrides.length > 0 ||
    parsedOverride.insightsOverride !==
      EMPTY_TUTOR_PROGRESS_OVERRIDE.insightsOverride;

  if (!hasContent) {
    return null;
  }

  const { data: tutorProfile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, email")
    .eq("id", overrideRow.tutor_id)
    .maybeSingle();

  return {
    tutorName: tutorProfile?.full_name || tutorProfile?.email || null,
    updatedAt: overrideRow.updated_at,
    override: parsedOverride,
  };
}
