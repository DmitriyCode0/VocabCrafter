import type { LearningLanguage } from "@/lib/languages";

export interface DefaultGrammarTopicDefinition {
  topicKey: string;
  displayName: string;
  level: string;
  learningLanguage: LearningLanguage;
}

const ENGLISH_GRAMMAR_TOPICS: Record<string, string[]> = {
  A1: [
    // Present
    "Present Simple with verb: positive",
    "Present Simple with verb: negative",
    "Present Simple with verb: questions",
    "Present Simple with verb mix: +, -, ?",
    "Present Simple Verb 'To Be' positive",
    "Present Simple Verb 'To Be' negative",
    "Present Simple Verb 'To Be' questions",
    "Present Simple 'To Be' vs 'To Do' mix: positive, negative, questions",
    "Present Continuous",

    // Past & Future
    "Was / Were",
    "Past Simple",
    "Future: Going to",
    "Future: Will",

    // Modals & Verbs
    "Can, Could",
    "Imperatives",
    "Verb Patterns (Inf/Ger)",

    // Nouns & Pronouns
    "Countable & Uncountable",
    "Subject Pronouns",
    "Object Pronouns",
    "Subject Pronouns vs Object Pronouns",
    "Possessive Adjectives",
    "Subject Pronouns vs Object Pronouns vs Possessive Adjectives",
    "This / That / These / Those",
    "Quantifiers many, much, little, few",
    "There is / There are",

    // Adjectives & Adverbs
    "Comparative Adjectives",
    "Superlative Adjectives",
    "Comparatives vs Superlatives Adjectives",
    "Adverbs formation",
    "Comparatives & Superlatives Adverbs",

    // Prepositions & Structure
    "Prepositions of Time: at, in, on",
    "Prepositions of Place: at, in, on",
    "Other Prepositions",
    "Conjunctions 'and but or so because'",
    "Question Words",
    "Word Order",
    "Have got",
  ],
  A2: [
    // Tenses
    "Present Simple vs Continuous",
    "Past Simple vs Continuous",
    "Present Perfect Basics",
    "Present Perfect vs Past Simple",
    "Past Perfect",

    // Future
    "Future: Will vs Going to",
    "Future: Present Continuous",

    // Modals
    "Must / Have to",
    "Should / Shouldn't",
    "May / Might (Possibility)",
    "Used to (Past Habits)",

    // Conditionals
    "First Conditional",
    "Second Conditional",

    // Verbs
    "Passive Voice (Simple)",
    "Gerunds & Infinitives",
    "Stative vs Dynamic Verbs",
    "Phrasal Verbs Basics",
    "Do vs Make",
    "Uses of 'Get'",

    // Nouns etc
    "Indefinite Pronouns",
    "Quantifiers (Much, Many, Some, Any)",
    "Too / Enough",
    "Possessive Pronouns",

    // Adjectives
    "Comparatives & Superlatives",
    "So / Neither (Agreement)",

    // Sentence
    "Relative Clauses (Defining)",
    "Connectors (However, Although, Because)",
    "Purpose (to / for)",
    "Subject Questions",
    "Prepositions of Movement",
  ],
  B1: [
    // Tenses
    "Past Simple vs Present Perfect",
    "Present Perfect Continuous",
    "Past Perfect",

    // Future
    "Future Forms Review",

    // Modals & Habits
    "Obligation & Advice (Must, Should, Ought to)",
    "Ability (Can, Could, Be able to)",
    "Deduction (Must, Might, Can't)",
    "Had better / Would rather",
    "Used to / Be used to / Get used to",

    // Conditionals
    "Zero & First Conditional",
    "Second Conditional",
    "Third Conditional",

    // Passive & Reported
    "Passive Voice (Intermediate)",
    "Reported Speech (Statements)",
    "Reported Speech (Questions)",

    // Verbs
    "Gerund vs Infinitive",
    "Phrasal Verbs (Common)",
    "Verb + Preposition",

    // Nouns etc
    "Articles (Definite, Indefinite, Zero)",
    "Quantifiers (All, Both, Either, Neither)",
    "Reflexive Pronouns",

    // Adj/Adv
    "Adjectives ending in -ed / -ing",
    "So vs Such",
    "Comparison (Advanced)",

    // Structure
    "Relative Clauses (Defining vs Non-defining)",
    "Question Tags",
    "Connectors of Purpose & Reason",
  ],
  B2: [
    // Complex Tenses
    "Narrative Tenses",
    "Future Continuous",
    "Future Perfect",

    // Past Modals
    "Past Modals (Should have / Could have)",
    "Deduction (Must have / Can't have)",
    "Habits (Will / Would for habits)",

    // Conditionals & Wishes
    "Third Conditional (Review)",
    "Mixed Conditionals",
    "Wishes & Regrets (I wish / If only)",

    // Passive & Causative
    "Passive (Advanced Structures)",
    "Causative (Have something done)",
    "Reporting Verbs (Passive)",

    // Verbs & Patterns
    "Gerund vs Infinitive (Meaning Change)",
    "Verbs of the Senses",
    "Participle Clauses (Reduced)",

    // Adjectives & Quantifiers
    "Adjective Order",
    "Gradable vs Non-gradable Adjectives",
    "Quantifiers (Advanced)",

    // Sentence Structure
    "Relative Clauses (Non-defining)",
    "Connectors of Contrast (Despite / In spite of)",
    "Inversion (Introduction)",
    "Cleft Sentences (What I need is...)",
  ],
  C1: [
    // Future & Tenses
    "Future in the Past",
    "Wishes & Unreal Past (It's time / I'd rather)",

    // Modals
    "Speculation & Deduction (Advanced)",

    // Conditionals
    "Mixed Conditionals",
    "Inverted Conditionals (Should / Had / Were)",
    "Alternatives to 'If' (Provided / Unless)",

    // Passive & Causative
    "Passive with Reporting Verbs (It is said that...)",
    "Passive with Two Objects",

    // Verbs & Patterns
    "Complex Gerunds & Infinitives",
    "Subjunctive Mood",

    // Nouns & Pronouns
    "Compound Nouns & Possessives",
    "Reflexive & Reciprocal Pronouns",

    // Adjectives & Adverbs
    "Compound Adjectives",
    "Modifying Comparatives (Far / Way / Slightly)",

    // Sentence Structure & Style
    "Inversion (Negative Adverbials)",
    "Cleft Sentences (It was... / What I need...)",
    "Participle Clauses",
    "Ellipsis & Substitution",
    "Discourse Markers",
  ],
};

const SPANISH_GRAMMAR_TOPICS: Record<string, string[]> = {
  A1: [
    "Spanish Subject Pronouns",
    "Ser: basic identity and origin",
    "Definite and Indefinite Articles",
    "Noun Gender and Number",
    "Adjective Agreement",
    "Hay (there is / there are)",
    "Regular -AR Verbs (Present)",
    "Regular -ER and -IR Verbs (Present)",
    "Tener: age and possession",
    "Basic Negation with No",
    "Simple Yes/No and Wh- Questions",
    "Gustar: singular things",
  ],
};

export const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function getGrammarTopicCatalog(
  language: LearningLanguage = "english",
): { level: string; topics: string[] }[] {
  const topicMap =
    language === "spanish" ? SPANISH_GRAMMAR_TOPICS : ENGLISH_GRAMMAR_TOPICS;

  return LEVEL_ORDER.filter((lvl) => topicMap[lvl]).map((lvl) => ({
    level: lvl,
    topics: topicMap[lvl],
  }));
}

export function getDefaultGrammarTopicDefinitions(
  language: LearningLanguage = "english",
): DefaultGrammarTopicDefinition[] {
  return getUniqueGrammarTopicCatalog(language).flatMap(({ level, topics }) =>
    topics.map((topicKey) => ({
      topicKey,
      displayName: topicKey,
      level,
      learningLanguage: language,
    })),
  );
}

export function getDefaultGrammarTopicDefinitionMap(): Map<
  string,
  DefaultGrammarTopicDefinition
> {
  return new Map(
    (["english", "spanish"] as const).flatMap((language) =>
      getDefaultGrammarTopicDefinitions(language).map((definition) => [
        definition.topicKey,
        definition,
      ]),
    ),
  );
}

export function getUniqueGrammarTopicCatalog(
  language: LearningLanguage = "english",
): { level: string; topics: string[] }[] {
  const seen = new Set<string>();

  return getGrammarTopicCatalog(language)
    .map(({ level, topics }) => ({
      level,
      topics: topics.filter((topic) => {
        if (seen.has(topic)) {
          return false;
        }

        seen.add(topic);
        return true;
      }),
    }))
    .filter(({ topics }) => topics.length > 0);
}

export function getAllGrammarTopicKeys(): string[] {
  const seen = new Set<string>();

  for (const language of ["english", "spanish"] as const) {
    for (const { topics } of getUniqueGrammarTopicCatalog(language)) {
      for (const topic of topics) {
        seen.add(topic);
      }
    }
  }

  return Array.from(seen);
}

export function getTopicsForLevel(
  level: string,
  language: LearningLanguage = "english",
): { level: string; topics: string[] }[] {
  const targetIndex = LEVEL_ORDER.indexOf(level);
  if (targetIndex === -1) return [];

  return getUniqueGrammarTopicCatalog(language).slice(0, targetIndex + 1);
}
