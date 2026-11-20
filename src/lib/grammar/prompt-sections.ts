import { getGrammarPromptDetails } from "@/lib/grammar/rules";
import type { GrammarChallenge } from "@/types/quiz";

function getGrammarDifficultyConstraint(difficulty: GrammarChallenge): string {
  switch (difficulty) {
    case "Simple":
      return "Use the direct, core form of this structure without burying it in nested clauses.";
    case "Standard":
      return "Apply the exact syntactic pattern and time/context triggers required by this grammar structure.";
    case "Complex":
      return "Combine this structure naturally with nuanced clauses or contrast.";
  }
}

export function formatGrammarRulesSection(
  topics: string[] | undefined,
  difficulty: GrammarChallenge,
  topicDetails?: Record<string, string>,
  topicLabels?: Record<string, string>,
): string {
  if (!topics || topics.length === 0) return "";

  const constraint = getGrammarDifficultyConstraint(difficulty);

  const rules = topics.map((topicKey) => {
    const ruleDetails =
      topicDetails?.[topicKey] ?? getGrammarPromptDetails(topicKey);
    const topicLabel = topicLabels?.[topicKey] ?? topicKey;
    if (!ruleDetails) return `- TOPIC: ${topicLabel}`;

    return `
- TOPIC: ${topicLabel}
  * Rule Details: ${ruleDetails.replace(/\n/g, " ")}
  * Constraint: ${constraint}`;
  });

  return `
The content must strictly enforce the following grammatical structure(s):
${rules.join("\n")}
ANTI-CLICHÉ & ANTI-CLONING RULE: Treat the examples inside Rule Details strictly as structural templates. NEVER reuse the nouns, characters, verbs, or clichéd scenes from those examples (such as drinking coffee, working in an office, living in London, playing football, or liking spiders).
`;
}
