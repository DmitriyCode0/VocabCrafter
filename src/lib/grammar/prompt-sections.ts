import { getGrammarPromptDetails } from "@/lib/grammar/rules";
import type { GrammarChallenge } from "@/types/quiz";

function getGrammarDifficultyConstraint(difficulty: GrammarChallenge): string {
  switch (difficulty) {
    case "Simple":
      return "Use the most basic form of this structure. Keep sentences short.";
    case "Standard":
      return "Use standard forms of this structure as demonstrated in the examples.";
    case "Complex":
      return "Combine this structure with others. Use in complex sentences with multiple clauses.";
  }
}

export function formatGrammarRulesSection(
  topics: string[] | undefined,
  difficulty: GrammarChallenge,
  topicDetails?: Record<string, string>,
): string {
  if (!topics || topics.length === 0) return "";

  const constraint = getGrammarDifficultyConstraint(difficulty);

  const rules = topics.map((topicKey) => {
    const ruleDetails =
      topicDetails?.[topicKey] ?? getGrammarPromptDetails(topicKey);
    if (!ruleDetails) return `- TOPIC: ${topicKey}`;

    return `
- TOPIC: ${topicKey}
  * Rule Details: ${ruleDetails.replace(/\n/g, " ")}
  * Constraint: ${constraint}`;
  });

  return `
The content must specifically test the following grammatical structures. Follow the constraints precisely:
${rules.join("\n")}
`;
}
