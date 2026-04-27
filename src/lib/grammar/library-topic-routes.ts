import type { LearningLanguage } from "@/lib/languages";

function slugifyTopicName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function getGrammarTopicSlug(topicKey: string) {
  return slugifyTopicName(topicKey) || "grammar-topic";
}

export function buildGrammarTopicArticleHref(
  learningLanguage: LearningLanguage,
  level: string,
  topicKey: string,
) {
  return `/library/grammar/${learningLanguage}/${encodeURIComponent(level)}/${getGrammarTopicSlug(topicKey)}`;
}