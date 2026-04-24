import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTutorStudentMonthlyReport } from "@/lib/progress/monthly-reports";
import { hasConfiguredTutorStudentPlan } from "@/lib/progress/tutor-student-plan";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    throw new Error("Missing CRON_SECRET environment variable");
  }

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const force = request.nextUrl.searchParams.get("force") === "1";
    const now = new Date();

    if (!force && now.getUTCDate() !== 28) {
      return NextResponse.json(
        {
          error:
            "Monthly report automation only runs on the 28th UTC unless force=1 is provided.",
        },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data: connections, error } = await admin
      .from("tutor_students")
      .select(
        "tutor_id, student_id, plan_title, goal_summary, objectives, monthly_quiz_target, monthly_completed_lessons_target, monthly_new_mastery_words_target, monthly_average_score_target",
      )
      .eq("status", "active");

    if (error) {
      throw error;
    }

    const summary = {
      processed: 0,
      created: 0,
      existing: 0,
      quotaBlocked: 0,
      failed: 0,
      errors: [] as Array<{
        tutorId: string;
        studentId: string;
        error: string;
      }>,
    };

    for (const connection of connections ?? []) {
      if (!connection.student_id) {
        continue;
      }

      if (
        !hasConfiguredTutorStudentPlan({
          planTitle: connection.plan_title,
          goalSummary: connection.goal_summary,
          objectives: Array.isArray(connection.objectives)
            ? connection.objectives.filter(
                (item): item is string => typeof item === "string",
              )
            : [],
          monthlyQuizTarget: connection.monthly_quiz_target,
          monthlyCompletedLessonsTarget:
            connection.monthly_completed_lessons_target,
          monthlyNewMasteryWordsTarget:
            connection.monthly_new_mastery_words_target,
          monthlyAverageScoreTarget: connection.monthly_average_score_target,
        })
      ) {
        continue;
      }

      summary.processed += 1;

      try {
        const result = await generateTutorStudentMonthlyReport({
          tutorId: connection.tutor_id,
          studentId: connection.student_id,
          generatedBy: null,
          generationSource: "scheduled",
          referenceDate: now,
          forceRegenerate: false,
        });

        if (result.report.status === "quota_blocked") {
          summary.quotaBlocked += 1;
        } else if (result.created) {
          summary.created += 1;
        } else {
          summary.existing += 1;
        }
      } catch (generationError) {
        summary.failed += 1;
        summary.errors.push({
          tutorId: connection.tutor_id,
          studentId: connection.student_id,
          error:
            generationError instanceof Error
              ? generationError.message
              : "Unknown generation error",
        });
      }
    }

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Monthly report cron error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to run monthly report automation",
      },
      { status: 500 },
    );
  }
}
