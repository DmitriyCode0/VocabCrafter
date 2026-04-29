import { NextResponse } from "next/server";
import { requireTutorStudentClassroomParticipantAccess } from "@/lib/classroom-access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: Request,
  {
    params,
  }: { params: Promise<{ connectionId: string; sessionId: string }> },
) {
  const { connectionId, sessionId } = await params;
  const access = await requireTutorStudentClassroomParticipantAccess(
    connectionId,
  );

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  if (access.role !== "tutor") {
    return NextResponse.json(
      { error: "Only tutors can delete classroom session summaries" },
      { status: 403 },
    );
  }

  const supabaseAdmin = createAdminClient();
  const { data: existingSummary, error: existingSummaryError } =
    await supabaseAdmin
      .from("tutor_student_classroom_session_summaries")
      .select("id")
      .eq("id", sessionId)
      .eq("classroom_id", access.classroom.id)
      .eq("connection_id", access.connection.id)
      .maybeSingle();

  if (existingSummaryError) {
    return NextResponse.json(
      { error: "Failed to load classroom session summary" },
      { status: 500 },
    );
  }

  if (!existingSummary) {
    return NextResponse.json(
      { error: "Classroom session summary not found" },
      { status: 404 },
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from("tutor_student_classroom_session_summaries")
    .delete()
    .eq("id", sessionId)
    .eq("classroom_id", access.classroom.id)
    .eq("connection_id", access.connection.id);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to delete classroom session summary" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}