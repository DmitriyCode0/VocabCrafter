import { CreateQuizFlow } from "@/components/quiz/create-quiz-flow";
import { getGrammarTopicPromptCatalog } from "@/lib/grammar/prompt-overrides";

export const dynamic = "force-dynamic";

export default async function NewQuizPage() {
  const [englishCatalog, spanishCatalog] = await Promise.all([
    getGrammarTopicPromptCatalog("english"),
    getGrammarTopicPromptCatalog("spanish"),
  ]);

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

  return <CreateQuizFlow grammarTopicCatalog={grammarTopicCatalog} />;
}
