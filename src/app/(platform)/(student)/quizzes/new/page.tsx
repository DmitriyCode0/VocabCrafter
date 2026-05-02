import { CreateQuizFlow } from "@/components/quiz/create-quiz-flow";
import { getGrammarTopicPromptCatalog } from "@/lib/grammar/prompt-overrides";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listStudentTutorPlans, type StudentTutorPlanCard } from "@/lib/progress/tutor-student-plan";

export const dynamic = "force-dynamic";

export default async function NewQuizPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [englishCatalog, spanishCatalog, studentPlans, grammarMasteryData] =
    await Promise.all([
      getGrammarTopicPromptCatalog("english"),
      getGrammarTopicPromptCatalog("spanish"),
      user
        ? listStudentTutorPlans(user.id).catch((): StudentTutorPlanCard[] => [])
        : Promise.resolve([] as StudentTutorPlanCard[]),
      user
        ? createAdminClient()
            .from("student_grammar_topic_mastery")
            .select("topic_key")
            .eq("student_id", user.id)
        : Promise.resolve({ data: null }),
    ]);

  const planGrammarTopicKeys: string[] = Array.from(
    new Set(
      studentPlans.flatMap((plan: StudentTutorPlanCard) =>
        (plan.plan.grammarTopicKeys ?? []).filter((k): k is string => typeof k === "string"),
      ),
    ),
  );
  const masteredGrammarTopicKeys: string[] = (
    (grammarMasteryData.data ?? []) as Array<{ topic_key: string }>
  ).map((row) => row.topic_key);

  const grammarTopicCatalog = {
    english: englishCatalog.map(({ level, topics }) => ({
      level,
      topics: topics.map(({ topicKey, displayName }) => ({
        topicKey,
        displayName,
      })),
    })),
    spanish: spanishCatalog.map(({ level, topics }) => ({
      level,
      topics: topics.map(({ topicKey, displayName }) => ({
        topicKey,
        displayName,
      })),
    })),
  };

  return (
    <CreateQuizFlow
      grammarTopicCatalog={grammarTopicCatalog}
      planGrammarTopicKeys={planGrammarTopicKeys}
      masteredGrammarTopicKeys={masteredGrammarTopicKeys}
    />
  );
}
