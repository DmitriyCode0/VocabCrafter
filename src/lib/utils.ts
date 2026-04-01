import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function stripMarkdownEmphasis(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/__/g, "");
}

export function removeSuggestedAnswerLines(feedback: string) {
  return feedback
    .split("\n")
    .filter((line) => !line.trim().toLowerCase().startsWith("suggested"))
    .join("\n");
}

export function getPrimaryGrammarTopic(config: unknown) {
  if (!config || typeof config !== "object") return null;

  const grammarTopics = (config as { grammarTopics?: unknown }).grammarTopics;

  if (!Array.isArray(grammarTopics) || typeof grammarTopics[0] !== "string") {
    return null;
  }

  return grammarTopics[0];
}

export function getGrammarTopicDisplayName(config: unknown, topicKey: string) {
  if (!config || typeof config !== "object") {
    return topicKey;
  }

  const labels = (config as { grammarTopicLabels?: unknown })
    .grammarTopicLabels;

  if (!labels || typeof labels !== "object") {
    return topicKey;
  }

  const label = (labels as Record<string, unknown>)[topicKey];
  return typeof label === "string" && label.trim() ? label : topicKey;
}
