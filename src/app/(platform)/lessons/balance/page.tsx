import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LessonBalanceManager } from "@/components/lessons/lesson-balance-manager";
import { LessonsPageHeader } from "@/components/lessons/lessons-page-header";
import { getAppMessages } from "@/lib/i18n/messages";
import { formatLessonMonthParam } from "@/lib/lessons";
import {
  autoCompleteOverduePlannedLessons,
  getTutorLessonBalanceSummaries,
} from "@/lib/lessons-server";
import { getLessonsViewerAccess } from "@/lib/lessons-access";

export default async function LessonsBalancePage() {
  const { userId, role, appLanguage } = await getLessonsViewerAccess({
    requireTutor: true,
  });
  const messages = getAppMessages(appLanguage);
  await autoCompleteOverduePlannedLessons({ tutorId: userId });
  const lessonBalanceSummaries = await getTutorLessonBalanceSummaries(userId);
  const currentMonth = new Date();

  return (
    <div className="space-y-6">
      <LessonsPageHeader
        role={role}
        currentSection="balance"
        title={messages.lessons.title}
        description={messages.lessons.balanceDescription}
        scheduleHref={`/lessons?month=${formatLessonMonthParam(currentMonth)}`}
        actions={
          <Badge variant="secondary">{messages.lessons.tutorOnlyBadge}</Badge>
        }
      />

      {lessonBalanceSummaries.length > 0 ? (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Student Balances</h2>
            <p className="text-sm text-muted-foreground">
              Set lesson pricing, record top-ups, and track how many completed
              lessons each balance currently covers.
            </p>
          </div>

          <LessonBalanceManager summaries={lessonBalanceSummaries} canManage />
        </div>
      ) : (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>No student balances yet</CardTitle>
            <CardDescription>
              Connect a student first to start tracking lesson balances here.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Once a student is connected, you will be able to set their lesson
            price, record top-ups, and review balance history from this page.
          </CardContent>
        </Card>
      )}
    </div>
  );
}