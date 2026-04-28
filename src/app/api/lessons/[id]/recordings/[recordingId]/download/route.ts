import { NextResponse } from "next/server";
import { requireLessonRoomParticipantAccess } from "@/lib/lesson-room-access";
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

  if (normalizedPath.endsWith(".ogg") || normalizedPath.endsWith(".oga")) {
    return "audio/ogg";
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

  return `lesson-recording-${recordingId}.mp4`;
}

function isDownloadableStatus(status: string) {
  return (
    status === "processing" || status === "ready" || status === "completed"
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; recordingId: string }> },
) {
  const { id, recordingId } = await params;
  const access = await requireLessonRoomParticipantAccess(id);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  const supabaseAdmin = createAdminClient();
  const { data: recording, error: recordingError } = await supabaseAdmin
    .from("lesson_room_recordings")
    .select("id, lesson_id, session_id, status, storage_bucket, storage_path")
    .eq("id", recordingId)
    .eq("lesson_id", id)
    .maybeSingle();

  if (recordingError) {
    return NextResponse.json(
      { error: "Failed to load lesson recording" },
      { status: 500 },
    );
  }

  if (!recording || recording.session_id !== access.session.id) {
    return NextResponse.json(
      { error: "Lesson recording not found" },
      { status: 404 },
    );
  }

  if (!recording.storage_bucket || !recording.storage_path) {
    return NextResponse.json(
      {
        error:
          "The selected lesson recording does not have a stored media file",
      },
      { status: 409 },
    );
  }

  if (!isDownloadableStatus(recording.status)) {
    return NextResponse.json(
      {
        error:
          recording.status === "recording"
            ? "The lesson recording is still active and cannot be downloaded yet"
            : "The selected lesson recording is not available for download",
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
            ? "The lesson recording file is still being finalized"
            : "Failed to download the lesson recording",
      },
      { status: recording.status === "processing" ? 409 : 500 },
    );
  }

  if (recordingBlob.size === 0) {
    return NextResponse.json(
      { error: "The lesson recording is empty" },
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
