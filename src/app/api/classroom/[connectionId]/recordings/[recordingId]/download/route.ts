import { NextResponse } from "next/server";
import { requireTutorStudentClassroomParticipantAccess } from "@/lib/classroom-access";
import { createAdminClient } from "@/lib/supabase/admin";

function getRecordingMimeType(
  path: string | null,
  blobType: string | undefined,
) {
  if (blobType) {
    return blobType;
  }

  const normalizedPath = path?.toLowerCase() ?? "";

  if (normalizedPath.endsWith(".mp4") || normalizedPath.endsWith(".m4v")) {
    return "video/mp4";
  }

  if (normalizedPath.endsWith(".mov")) {
    return "video/quicktime";
  }

  if (normalizedPath.endsWith(".mp3")) {
    return "audio/mpeg";
  }

  if (normalizedPath.endsWith(".wav")) {
    return "audio/wav";
  }

  if (normalizedPath.endsWith(".m4a")) {
    return "audio/mp4";
  }

  return "video/mp4";
}

function getRecordingFilename(recordingId: string, storagePath: string | null) {
  const pathSegments = storagePath?.split("/") ?? [];
  const candidate = pathSegments[pathSegments.length - 1]?.trim();

  if (candidate) {
    return candidate.replace(/["\\]/g, "");
  }

  return `classroom-recording-${recordingId}.mp4`;
}

function isDownloadableStatus(status: string) {
  return (
    status === "processing" || status === "ready" || status === "completed"
  );
}

export async function GET(
  _request: Request,
  {
    params,
  }: { params: Promise<{ connectionId: string; recordingId: string }> },
) {
  const { connectionId, recordingId } = await params;
  const access =
    await requireTutorStudentClassroomParticipantAccess(connectionId);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  const supabaseAdmin = createAdminClient();
  const { data: recording, error: recordingError } = await supabaseAdmin
    .from("tutor_student_classroom_recordings")
    .select("id, classroom_id, status, storage_bucket, storage_path")
    .eq("id", recordingId)
    .eq("classroom_id", access.classroom.id)
    .maybeSingle();

  if (recordingError) {
    return NextResponse.json(
      { error: "Failed to load classroom recording" },
      { status: 500 },
    );
  }

  if (!recording) {
    return NextResponse.json(
      { error: "Classroom recording not found" },
      { status: 404 },
    );
  }

  if (!recording.storage_bucket || !recording.storage_path) {
    return NextResponse.json(
      {
        error:
          "The selected classroom recording does not have a stored media file",
      },
      { status: 409 },
    );
  }

  if (!isDownloadableStatus(recording.status)) {
    return NextResponse.json(
      {
        error:
          recording.status === "recording"
            ? "The classroom recording is still active and cannot be downloaded yet"
            : "The selected classroom recording is not available for download",
      },
      { status: 409 },
    );
  }

  const { data: recordingBlob, error: downloadError } =
    await supabaseAdmin.storage
      .from(recording.storage_bucket)
      .download(recording.storage_path);

  if (downloadError || !recordingBlob) {
    return NextResponse.json(
      {
        error:
          recording.status === "processing"
            ? "The classroom recording file is still being finalized"
            : "Failed to download the classroom recording",
      },
      { status: recording.status === "processing" ? 409 : 500 },
    );
  }

  if (recordingBlob.size === 0) {
    return NextResponse.json(
      { error: "The classroom recording is empty" },
      { status: 409 },
    );
  }

  const responseBuffer = await recordingBlob.arrayBuffer();

  return new NextResponse(responseBuffer, {
    headers: {
      "Content-Type": getRecordingMimeType(
        recording.storage_path,
        recordingBlob.type || undefined,
      ),
      "Content-Disposition": `attachment; filename="${getRecordingFilename(recording.id, recording.storage_path)}"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}