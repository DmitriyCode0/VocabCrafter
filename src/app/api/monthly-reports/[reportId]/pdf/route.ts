import { NextResponse } from "next/server";
import { getReportLanguageLocale } from "@/lib/progress/monthly-report-language";
import {
  buildMonthlyReportPdf,
  getMonthlyReportPdfFilename,
} from "@/lib/progress/monthly-report-pdf";
import { getMonthlyReportById } from "@/lib/progress/monthly-reports";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const report = await getMonthlyReportById(reportId);

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const canAccess =
    profile.role === "superadmin" ||
    (profile.role === "tutor" && report.tutorId === user.id) ||
    (profile.role === "student" &&
      report.studentId === user.id &&
      report.status === "published");

  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!report.publishedContent) {
    return NextResponse.json(
      { error: "The report does not have published content yet" },
      { status: 400 },
    );
  }

  const profileIds = [...new Set([report.studentId, report.tutorId])];
  const { data: people, error: peopleError } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", profileIds);

  if (peopleError) {
    console.error("Load monthly report PDF people error:", peopleError);
    return NextResponse.json(
      { error: "Failed to load report context" },
      { status: 500 },
    );
  }

  const peopleMap = new Map((people ?? []).map((person) => [person.id, person]));
  const studentName =
    peopleMap.get(report.studentId)?.full_name ||
    peopleMap.get(report.studentId)?.email ||
    "Student";
  const tutorName =
    peopleMap.get(report.tutorId)?.full_name ||
    peopleMap.get(report.tutorId)?.email ||
    "Tutor";
  const locale = getReportLanguageLocale(report.goalsSnapshot.reportLanguage);

  try {
    const pdfBytes = await buildMonthlyReportPdf({
      report,
      studentName,
      tutorName,
      locale,
    });

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${getMonthlyReportPdfFilename(report, studentName)}"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Build monthly report PDF error:", error);
    return NextResponse.json(
      { error: "Failed to build PDF" },
      { status: 500 },
    );
  }
}