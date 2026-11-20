import type { SourceLanguage } from "@/lib/languages";
import type { CEFRLevel, QuizConfig, QuizTerm } from "@/types/quiz";

export interface TopicSubRuleSpec {
  id: string;
  label: string;
  requiredStructure: string;
  sourceTriggers: string;
  forbiddenShortcuts?: string;
  requiresQuestionMark?: boolean;
  englishMustMatchAny?: RegExp[];
  englishMustNotMatch?: RegExp[];
}

export interface WordBlueprint {
  term: QuizTerm;
  everydayContextHint: string;
  subRule?: TopicSubRuleSpec;
  candidateCount: number;
}

const NATURAL_CONTEXT_THEMES = [
  "home, room, or family daily life (when natural for the word)",
  "city, shop, street, or getting around (when natural for the word)",
  "school, study, or everyday work (when natural for the word)",
  "free time, friends, health, or personal feelings (when natural for the word)",
  "weekend plans, weather, food, or everyday problems (when natural for the word)",
] as const;

export const CANDIDATE_ANGLES = [
  "Simple everyday statement",
  "Natural spoken remark between two people",
  "Everyday situation with a quick reaction or detail",
  "Short two-part mini-thought or simple contrast",
] as const;

export function getCefrSentenceCeiling(level: CEFRLevel): string {
  switch (level) {
    case "A1":
      return `CEFR A1 SIMPLICITY & LENGTH CEILING (HIGHEST PRIORITY):
- Total length: 5 to 11 words MAX (either 1 short, crisp clause OR 2 very short 3–6 word sentences).
- Keep the surrounding grammar 100% basic A1: ONLY Present Simple, simple Past Simple (e.g. "opened", "took", "saw", "was/were"), "there is/are/was/were", "it is/was", "can", and "want to / need to".
- STRICTLY FORBIDDEN AT A1: passive voice ("Marta was asked..."), reported speech ("asked if..."), relative clauses, participle clauses, stacked prepositional phrases (max 1 simple place/time phrase per clause), or forced characters.
- Even if the target vocabulary word itself is advanced (e.g. a phrasal verb, idiom, or B2 noun), wrap it in dead-simple A1 everyday grammar like:
  "It is dangerous to drive at night." | "There was a problem with the car. We took a taxi." | "I'm watching a new series. It's very good." | "There aren't any students in the classroom."`;
    case "A2":
      return `CEFR A2 SIMPLICITY & LENGTH CEILING:
- Total length: 7 to 14 words MAX (1 clear sentence, 1 simple compound sentence with and/but/so/because, or 2 short connected sentences).
- Surrounding grammar must stay elementary A2 (basic Present/Past tenses, basic future, must/have to/should). No B2/C1 complex passive or nested clauses unless explicitly required by the selected Grammar Topic.`;
    case "B1":
      return `CEFR B1 LENGTH & CLARITY GUIDE:
- Keep sentences natural and direct (9 to 16 words). Clear everyday situations — never convoluted or overstuffed with extra clauses.`;
    default:
      return `CEFR ${level} STYLE GUIDE:
- Aim for natural, authentic phrasing (10 to 20 words) that sounds like real human speech or writing, never artificially stuffed.`;
  }
}

const SUB_RULE_POOLS: Record<string, TopicSubRuleSpec[]> = {
  // ═══ A1 ENGLISH ═══
  "Present Simple with verb: positive": [
    {
      id: "ps-pos-3sg",
      label: "3rd person singular Affirmative (+s/-es/-ies)",
      requiredStructure:
        "Positive Present Simple sentence with a singular 3rd-person subject (he/she/my sister/a neighbor) + verb with -s/-es/-ies.",
      sourceTriggers:
        "Use a clear routine/fact cue in the source sentence (e.g. щодня, зазвичай, щосуботи, завжди).",
    },
    {
      id: "ps-pos-plural",
      label: "1st/2nd/Plural Affirmative (base verb)",
      requiredStructure:
        "Positive Present Simple sentence with I/we/you/they/plural noun + base verb.",
      sourceTriggers:
        "Include a habitual frequency cue (e.g. часто, щотижня, у будні, інколи).",
    },
  ],
  "Present Simple with verb: negative": [
    {
      id: "ps-neg-3sg",
      label: "3rd person singular Negative (doesn't + base verb)",
      requiredStructure:
        "Negative Present Simple sentence using does not / doesn't + base verb.",
      sourceTriggers:
        "Use a present habitual negation cue (e.g. зазвичай не ..., ніколи не ..., по вихідних не ...).",
      englishMustMatchAny: [/\bdoesn['’]?t\b|\bdoes not\b/i],
    },
    {
      id: "ps-neg-plural",
      label: "1st/2nd/Plural Negative (don't + base verb)",
      requiredStructure:
        "Negative Present Simple sentence using do not / don't + base verb.",
      sourceTriggers:
        "Express a general habit/preference negation in the present (e.g. зазвичай не ..., рідко ...).",
      englishMustMatchAny: [/\bdon['’]?t\b|\bdo not\b/i],
    },
  ],
  "Present Simple with verb: questions": [
    {
      id: "ps-q-yesno",
      label: "Yes/No Question (Do/Does + subject + base verb?)",
      requiredStructure:
        "Direct Yes/No question in Present Simple starting with Do or Does and ending with '?'.",
      sourceTriggers:
        "Phrase as a natural Ukrainian yes/no question with 'Чи ... зазвичай/часто ...?'.",
      requiresQuestionMark: true,
      englishMustMatchAny: [/^(do|does)\b/i],
    },
    {
      id: "ps-q-wh",
      label: "Wh- Question (Where/When/Why/How often + do/does...?)",
      requiredStructure:
        "Information question starting with a Wh-word (Where/When/Why/How often/What) + do/does + subject + base verb?",
      sourceTriggers:
        "Ask about a regular habit or schedule using Де/Коли/Чому/Як часто...",
      requiresQuestionMark: true,
      englishMustMatchAny: [/\b(do|does)\b.*\?$/i],
    },
  ],
  "Present Simple with verb mix: +, -, ?": [
    {
      id: "ps-mix-pos",
      label: "Positive (+) Present Simple statement",
      requiredStructure:
        "Affirmative Present Simple sentence with an action verb (especially 3rd-person singular -s/-es or plural routine).",
      sourceTriggers: "Include a clear habit/routine frequency adverb.",
    },
    {
      id: "ps-mix-neg",
      label: "Negative (-) Present Simple statement (don't/doesn't)",
      requiredStructure:
        "Negative Present Simple sentence using don't or doesn't + base verb.",
      sourceTriggers: "Clear present negation with 'не' + imperfective verb.",
      englishMustMatchAny: [/\b(don['’]?t|doesn['’]?t|do not|does not)\b/i],
    },
    {
      id: "ps-mix-q-yn",
      label: "Yes/No Question (?) in Present Simple",
      requiredStructure:
        "Yes/No question starting with Do or Does.",
      sourceTriggers: "Ask a direct yes/no question ending in '?'.",
      requiresQuestionMark: true,
      englishMustMatchAny: [/^(do|does)\b/i],
    },
    {
      id: "ps-mix-q-wh",
      label: "Wh- Question (?) in Present Simple",
      requiredStructure:
        "Wh- question using do or does before the subject.",
      sourceTriggers: "Ask an open habit question ending in '?'.",
      requiresQuestionMark: true,
      englishMustMatchAny: [/\b(do|does)\b/i],
    },
  ],
  "Present Simple Verb 'To Be' positive": [
    {
      id: "be-pos",
      label: "Affirmative 'to be' (am / is / are + adj/noun/place)",
      requiredStructure:
        "Present Simple positive sentence where 'am', 'is', or 'are' is the main verb (followed by an adjective, noun, or prepositional phrase — NOT another action verb).",
      sourceTriggers:
        "Describe a present state, location, profession, or quality where Ukrainian omits the verb 'є' (e.g. 'Ця кімната дуже світла').",
      englishMustMatchAny: [/\b(am|is|are|'m|'re|'s)\b/i],
    },
  ],
  "Present Simple Verb 'To Be' negative": [
    {
      id: "be-neg",
      label: "Negative 'to be' (am not / isn't / aren't)",
      requiredStructure:
        "Present Simple negative sentence with 'am not', 'is not/isn't', or 'are not/aren't' as the main verb.",
      sourceTriggers:
        "State a present state/quality negation using 'не' without an action verb (e.g. 'не втомився/не готовий/не впевнений/не тут').",
      englishMustMatchAny: [/\b(am not|is not|isn['’]?t|are not|aren['’]?t)\b/i],
    },
  ],
  "Present Simple Verb 'To Be' questions": [
    {
      id: "be-q",
      label: "Question with 'to be' (Am/Is/Are...? or Wh- + is/are...?)",
      requiredStructure:
        "Present Simple question using inverted 'Am / Is / Are' as the main verb, ending with '?'. No do/does allowed.",
      sourceTriggers:
        "Ask about a current state, location, or attribute in Ukrainian (no action verb).",
      requiresQuestionMark: true,
      englishMustMatchAny: [/\b(am|is|are)\b/i],
      englishMustNotMatch: [/\b(do|does)\b/i],
    },
  ],
  "Present Simple 'To Be' vs 'To Do' mix: positive, negative, questions": [
    {
      id: "be-vs-do-be-pos",
      label: "'To Be' State Sentence (Positive/Negative)",
      requiredStructure:
        "Use 'am/is/are' (+ or -) with an adjective, noun, or location — NO action verb and NO do/does.",
      sourceTriggers: "Describe a state, location, or feeling.",
      englishMustMatchAny: [/\b(am|is|are|isn['’]?t|aren['’]?t)\b/i],
    },
    {
      id: "be-vs-do-be-q",
      label: "'To Be' Question (?)",
      requiredStructure:
        "Ask a question inverting Am/Is/Are — NO do/does.",
      sourceTriggers: "Question about state, price, time, location, or quality.",
      requiresQuestionMark: true,
      englishMustMatchAny: [/\b(am|is|are)\b/i],
      englishMustNotMatch: [/\b(do|does)\b/i],
    },
    {
      id: "be-vs-do-action-neg",
      label: "Action Verb Negative (don't / doesn't)",
      requiredStructure:
        "Use an action verb in Present Simple negative with don't/doesn't.",
      sourceTriggers: "Habitual negative action with explicit action verb.",
      englishMustMatchAny: [/\b(don['’]?t|doesn['’]?t|do not|does not)\b/i],
    },
    {
      id: "be-vs-do-action-q",
      label: "Action Verb Question (Do / Does...?)",
      requiredStructure:
        "Ask a question about an action using Do/Does + subject + base verb.",
      sourceTriggers: "Question about an action or habit ending in '?'.",
      requiresQuestionMark: true,
      englishMustMatchAny: [/\b(do|does)\b/i],
    },
  ],
  "Present Continuous": [
    {
      id: "pc-now",
      label: "Action happening right now (am/is/are + V-ing)",
      requiredStructure:
        "Present Continuous (am/is/are + verb-ing) expressing an action visibly or actively in progress right now.",
      sourceTriggers:
        "MUST include an unmistakable immediate-present cue in Ukrainian such as 'зараз', 'у цю мить', 'прямо зараз', 'Подивись!', or 'Послухай!'.",
      forbiddenShortcuts:
        "Do NOT use stative verbs (like, know, want, need) or timeless habits that could be translated in Present Simple.",
      englishMustMatchAny: [/\b(am|is|are|'m|'re|'s)\s+(?:not\s+)?\w+ing\b/i],
    },
  ],
  "There is / There are": [
    {
      id: "there-is-are-exist",
      label: "Existential There is / There are / There isn't / Is there",
      requiredStructure:
        "Use 'There is/isn't/are/aren't' (or 'Is/Are there...?') to introduce something in a place or situation. NEVER start Ukrainian with dummy 'Там є/був' to translate existential 'There is'; ONLY use leading 'Там' if you literally mean 'in that place over there' AND include a second 'there' at the end of the English clause (e.g. 'There is a book there.').",
      sourceTriggers:
        "Prefer natural Ukrainian openings with a concrete location phrase or without 'Там' (e.g. 'На столі є книжка.', 'У нашому районі є нова аптека.'). If you do write 'Там є...', the English reference MUST end that clause with 'there' ('There is a butcher's there.').",
      forbiddenShortcuts:
        "NEVER combine leading 'Там' with another place phrase in the same clause ('Там був магазин біля мого дому' is WRONG — write 'Біля мого дому був магазин.' without 'Там').",
      englishMustMatchAny: [/\bthere\s+(is|are|isn['’]?t|aren['’]?t|was|were)\b/i, /\b(is|are|was|were)\s+there\b/i],
    },
  ],
  "There vs It": [
    {
      id: "there-where-when-exists",
      label:
        "THERE (is/are/was/were/isn't/aren't) to say when/where something is or that it exists/happened",
      requiredStructure:
        "Use simple 'There is/are/was/were/aren't any + INDEFINITE noun phrase (a/an/some/any/no + target noun) + short place or time'. NEVER put 'our/my/the' directly after 'There is/are'. CRITICAL 'THERE' vs 'ТАМ' RULE: Either write the Ukrainian sentence WITHOUT leading 'Там' using a natural place/event opening (e.g. 'Біля мого дому був новий рибний магазин.' -> 'There was a new fishmonger's near my house.') OR, if Ukrainian genuinely begins with 'Там', include a second locative 'there' at the end of the English sentence ('Там є м'ясна лавка.' -> 'There is a butcher's there.').",
      sourceTriggers:
        "Start Ukrainian concisely with a concrete place/time phrase or event WITHOUT dummy 'Там' (e.g. 'У моїй школі є новий учитель.', 'У класі немає учнів.', 'З машиною була проблема. Ми взяли таксі.', 'Біля мого дому був новий рибний магазин.'). Only start with 'Там є/був...' if English ends that clause with a second 'there'.",
      forbiddenShortcuts:
        "NEVER use a definite possessive like 'our/the' right after 'There is/are', and NEVER start Ukrainian with dummy 'Там' when another place phrase (like 'біля мого дому' or 'на вулиці') is already present.",
      englishMustMatchAny: [
        /\bthere('s|\s+(is|are|was|were|isn['’]?t|aren['’]?t|wasn['’]?t|weren['’]?t))\b/i,
      ],
    },
    {
      id: "it-adj-infinitive-or-state",
      label:
        "IT for 'It is/was + simple adjective + to + verb' OR time/weather/distance (ONLY when natural for the word)",
      requiredStructure:
        "If the target word is a verb/phrase or adjective, use a short single sentence: 'It is / It was + easy/hard/dangerous/nice/important + to + [verb]...' (like 'It is dangerous to drive at night.') OR 'It's late and I want to...' / 'It is very cold today.'. Only use weather/time/distance if it genuinely fits the target word without artificial 'so' glue.",
      sourceTriggers:
        "Use short impersonal Ukrainian phrasing ('Небезпечно водити вночі', 'Важко знайти...', 'Зараз пізно, і я хочу додому', 'Сьогодні дуже холодно').",
      forbiddenShortcuts:
        "NEVER glue an unrelated weather/time clause with 'so' just to force the word in (e.g. NEVER write 'It is 5 degrees, so my sister has to use up wood').",
      englishMustMatchAny: [/\b(it's|it is|it was|is it)\b/i],
    },
    {
      id: "there-then-it-reference",
      label:
        "Two short sentences: introduce with THERE/noun, then refer back with IT (plural -> THEY, singular -> IT)",
      requiredStructure:
        "Write two ultra-short A1 sentences matching number agreement: if the noun is SINGULAR/UNCOUNTABLE, Sentence 1 introduces it ('There's a park opposite my house.' / 'I'm watching a new series.' / 'There is a butcher's there.') and Sentence 2 uses 'It is / It's / It was + short adjective.' ('It is beautiful.' / 'It's very clean.'). If Sentence 1 in Ukrainian uses 'Там', Sentence 1 in English MUST include the second 'there' at the end ('There is a butcher's there. It is very clean.'); otherwise avoid leading 'Там' in Ukrainian by naming a clear place ('На нашій вулиці є м'ясна лавка. Вона дуже чиста.'). If the target word is PLURAL, use 'There are some...' and 'They are...'.",
      sourceTriggers:
        "Write two very short, natural Ukrainian sentences where Sentence 2 evaluates Sentence 1. Prefer concrete places without 'Там' (e.g. 'Навпроти мого дому є парк. Він чудовий.' / 'На розі є м'ясна лавка. Вона дуже чиста.'); if using 'Там є...', English MUST end Sentence 1 with 'there'.",
      forbiddenShortcuts:
        "NEVER omit 'It/They' in Sentence 2, NEVER refer to a plural noun with singular 'It is', and NEVER write 'Там є X.' -> 'There is X.' without the second 'there'.",
      englishMustMatchAny: [/\b(it's|it is|it was|it will be|they are|they're|they were)\b/i],
    },
  ],
  "Was / Were": [
    {
      id: "was-were-pos-neg",
      label: "Past state with was / were (or wasn't / weren't)",
      requiredStructure:
        "Past Simple of 'to be' (was / were / wasn't / weren't) + adjective/noun/place.",
      sourceTriggers:
        "Include a past time marker (e.g. вчора ввечері, минулої суботи, два тижні тому).",
      englishMustMatchAny: [/\b(was|were|wasn['’]?t|weren['’]?t)\b/i],
    },
    {
      id: "was-were-q",
      label: "Past state question (Was / Were ...?)",
      requiredStructure:
        "Past question starting with Was/Were or Wh- + was/were.",
      sourceTriggers: "Ask a past question about where someone was or how something was.",
      requiresQuestionMark: true,
      englishMustMatchAny: [/\b(was|were)\b/i],
    },
  ],
  "Future: Going to": [
    {
      id: "going-to-plan",
      label: "Prior intention / plan (be going to + verb)",
      requiredStructure:
        "Use 'am/is/are going to + base verb' to express a pre-decided plan or intention.",
      sourceTriggers:
        "MUST use clear planning vocabulary in Ukrainian such as 'збирається', 'планує', 'вирішив(-ла) купити/зробити' so the student knows to use 'going to' rather than 'will'.",
      englishMustMatchAny: [/\bgoing to\b/i],
    },
    {
      id: "going-to-evidence",
      label: "Prediction from visible evidence (be going to)",
      requiredStructure:
        "Present visible evidence followed by 'is/are going to' prediction.",
      sourceTriggers:
        "Include clear sensory/visible evidence right before the prediction (e.g. 'Подивись на ці чорні хмари — ось-ось піде...').",
      englishMustMatchAny: [/\bgoing to\b/i],
    },
  ],
  "Future: Will": [
    {
      id: "will-decision-promise",
      label: "Spontaneous decision, offer, or promise (will / won't)",
      requiredStructure:
        "Use 'will' / ''ll' / 'won't' for an on-the-spot decision, offer, or explicit promise.",
      sourceTriggers:
        "Use cues like 'Зачекай, я зараз...', 'Добре, тоді я...', 'Обіцяю, що...', or 'Мабуть / Сподіваюся, що...'.",
      forbiddenShortcuts:
        "Do NOT describe a pre-arranged appointment or schedule (which favors going to / Present Continuous).",
      englishMustMatchAny: [/\b(will|won['’]?t)\b|'ll\b/i],
    },
  ],
  Imperatives: [
    {
      id: "imp-pos",
      label: "Positive Imperative (Base verb...)",
      requiredStructure: "Direct instruction or polite request starting with base verb (or Please + base verb).",
      sourceTriggers: "Use 2nd-person imperative mood in Ukrainian (e.g. Перевір..., Візьми..., Будь ласка, закрий...).",
    },
    {
      id: "imp-neg",
      label: "Negative Imperative (Don't + base verb...)",
      requiredStructure: "Warning or prohibition starting with 'Don't + base verb'.",
      sourceTriggers: "Use 'Не + imperative verb' in Ukrainian (e.g. Не забудь..., Не залишай...).",
      englishMustMatchAny: [/\bdon['’]?t\b|\bdo not\b|\bnever\b/i],
    },
  ],

  // ═══ A2 ENGLISH ═══
  "Present Simple vs Continuous": [
    {
      id: "ps-vs-pc-routine",
      label: "Present Simple (routine / permanent truth)",
      requiredStructure:
        "Present Simple tense describing a repeatable routine or general fact.",
      sourceTriggers:
        "MUST include a routine marker in Ukrainian such as 'щодня', 'зазвичай', 'кожні вихідні', 'завжди'.",
    },
    {
      id: "ps-vs-pc-now",
      label: "Present Continuous (temporary / right now)",
      requiredStructure:
        "Present Continuous (am/is/are + V-ing) describing a temporary action or event happening at this moment.",
      sourceTriggers:
        "MUST include a contrast or immediacy marker such as 'зараз', 'цього тижня винятково', 'у цей момент', or 'Зазвичай..., але сьогодні...'.",
      englishMustMatchAny: [/\b(am|is|are|'m|'re|'s)\s+(?:not\s+)?\w+ing\b/i],
    },
  ],
  "Past Simple vs Continuous": [
    {
      id: "past-simple-completed",
      label: "Past Simple (completed action / sequence)",
      requiredStructure:
        "Past Simple tense (or two consecutive completed past actions) with a finished past time expression.",
      sourceTriggers:
        "Use perfective past verbs in Ukrainian with a closed time marker (e.g. вчора ввечері, спочатку ... а потім...).",
    },
    {
      id: "past-cont-interrupted",
      label: "Past Continuous + Past Simple (interrupted background action)",
      requiredStructure:
        "Past Continuous (was/were + V-ing) for the longer background action + Past Simple for the interrupting event.",
      sourceTriggers:
        "MUST pair an ongoing Ukrainian imperfective past verb with 'коли раптом / саме в той час як' + perfective interrupting event.",
      englishMustMatchAny: [/\b(was|were|wasn['’]?t|weren['’]?t)\s+\w+ing\b/i],
    },
  ],
  "Present Perfect Basics": [
    {
      id: "pp-experience",
      label: "Life experience (ever / never + V3)",
      requiredStructure:
        "Present Perfect (have/has + ever/never + past participle) without specifying when.",
      sourceTriggers:
        "MUST use 'коли-небудь' or 'ніколи раніше / ще ніколи' with no past date.",
      englishMustMatchAny: [/\b(have|has|haven['’]?t|hasn['’]?t)\b|'ve\b/i],
    },
    {
      id: "pp-just-already-yet",
      label: "Recent action / present relevance (already / just / yet)",
      requiredStructure:
        "Present Perfect with 'just', 'already', or 'yet' + past participle.",
      sourceTriggers:
        "MUST include explicit Ukrainian trigger: 'щойно', 'вже', or 'ще не'.",
      englishMustMatchAny: [/\b(have|has|haven['’]?t|hasn['’]?t)\b|'ve\b/i],
    },
  ],
  "Present Perfect vs Past Simple": [
    {
      id: "pp-vs-past-pp",
      label: "Present Perfect (unfinished time / already / yet / present result)",
      requiredStructure:
        "Present Perfect (have/has + V3) — NEVER include a finished past time expression like 'yesterday'.",
      sourceTriggers:
        "MUST include an unmistakable Present Perfect cue: 'вже', 'ще не', 'щойно', 'коли-небудь', 'цього тижня', or a visible present result clause ('..., тому зараз...').",
      englishMustMatchAny: [/\b(have|has|haven['’]?t|hasn['’]?t)\b|'ve\b/i],
    },
    {
      id: "pp-vs-past-ps",
      label: "Past Simple (finished past time)",
      requiredStructure:
        "Past Simple with a specific finished past time reference.",
      sourceTriggers:
        "MUST include a closed past-time phrase in Ukrainian: 'вчора', 'минулого вівторка', 'два дні тому', 'у 2022 році', 'на початку місяця'.",
      englishMustNotMatch: [/\b(have|has)\s+(ever|never|already|just)\b/i],
    },
  ],
  "Past Simple vs Present Perfect": [
    {
      id: "past-vs-pp-pp",
      label: "Present Perfect (unfinished time / already / yet / present result)",
      requiredStructure:
        "Present Perfect (have/has + V3) with no finished past time anchor.",
      sourceTriggers:
        "MUST use a Present Perfect trigger ('вже', 'ще не', 'щойно', 'сьогодні вранці [if still morning]', 'ніколи раніше', or present consequence).",
      englishMustMatchAny: [/\b(have|has|haven['’]?t|hasn['’]?t)\b|'ve\b/i],
    },
    {
      id: "past-vs-pp-ps",
      label: "Past Simple (specific closed past time)",
      requiredStructure:
        "Past Simple verb form anchored to a finished moment in the past.",
      sourceTriggers:
        "MUST state exactly when it happened in the past ('вчора', 'минулого тижня', 'три роки тому').",
    },
  ],
  "Past Perfect": [
    {
      id: "past-perfect-sequence",
      label: "Earlier past action before another past event (had + V3)",
      requiredStructure:
        "Sentence with two past clauses: the earlier action uses 'had (not) + V3' and the later action uses Past Simple.",
      sourceTriggers:
        "MUST clearly establish time order in Ukrainian using 'До того часу, як...', 'Ще до того, як...', or 'Коли [ми прийшли], ... вже [зробив]...'.",
      englishMustMatchAny: [/\b(had|hadn['’]?t|'d)\b/i],
    },
  ],
  "Future: Will vs Going to": [
    {
      id: "will-vs-going-will",
      label: "Will (spontaneous reaction, offer, promise)",
      requiredStructure:
        "Sentence expressing an immediate reaction, promise, or offer using 'will' / ''ll' / 'won't'.",
      sourceTriggers:
        "Include conversational immediacy cues like 'Ой, здається ... — я зараз...', 'Не хвилюйся, я...', 'Обіцяю, що...'.",
      englishMustMatchAny: [/\b(will|won['’]?t)\b|'ll\b/i],
    },
    {
      id: "will-vs-going-to",
      label: "Be going to (pre-made plan or clear physical evidence)",
      requiredStructure:
        "Sentence using 'am/is/are going to + verb' for a prior intention or clear physical evidence.",
      sourceTriggers:
        "Use 'планує / збирається' or obvious visual evidence before the result.",
      englishMustMatchAny: [/\bgoing to\b/i],
    },
  ],
  "Future: Present Continuous": [
    {
      id: "future-pc-arrangement",
      label: "Confirmed personal arrangement (am/is/are + V-ing + future time)",
      requiredStructure:
        "Present Continuous referring to a fixed future plan/appointment with a future time/date.",
      sourceTriggers:
        "Mention concrete arrangements in Ukrainian (e.g. 'завтра о 15:00 я зустрічаюся з...', 'ми вже забронювали / домовилися, що у п'ятницю летимо/йдемо...').",
      englishMustMatchAny: [/\b(am|is|are|'m|'re|'s)\s+(?:not\s+)?\w+ing\b/i],
    },
  ],
  "Must / Have to": [
    {
      id: "must-internal-prohibition",
      label: "Personal strong necessity ('must') or prohibition ('mustn't')",
      requiredStructure:
        "Use 'must' (personal inner urgency) or 'mustn't' (strict prohibition — NOT 'don't have to').",
      sourceTriggers:
        "For 'must', emphasize personal urge ('Я неодмінно повинен...'); for 'mustn't', express strict prohibition ('Суворо заборонено / Ні в якому разі не можна...').",
      englishMustMatchAny: [/\b(must|mustn['’]?t|must not)\b/i],
    },
    {
      id: "have-to-external-free",
      label: "External rule ('have to / has to') or lack of obligation ('don't/doesn't have to')",
      requiredStructure:
        "Use 'have to / has to' for an external rule/schedule or 'don't/doesn't have to' for something unnecessary.",
      sourceTriggers:
        "Use external rule cues ('За правилами / Через роботу змушений...') or 'Немає потреби / Не обов'язково...' for lack of obligation.",
      englishMustMatchAny: [/\b(have to|has to|had to|don['’]?t have to|doesn['’]?t have to)\b/i],
    },
  ],
  "Should / Shouldn't": [
    {
      id: "should-advice",
      label: "Advice or recommendation (should / shouldn't + bare infinitive)",
      requiredStructure: "Use 'should' or 'shouldn't' to give practical advice.",
      sourceTriggers: "Use 'Тобі/Йому варто...', 'На твому місці я б...', 'Не варто...'.",
      englishMustMatchAny: [/\bshould(n['’]?t)?\b/i],
    },
  ],
  "May / Might (Possibility)": [
    {
      id: "may-might-uncertainty",
      label: "Uncertain possibility (may / might / might not + verb)",
      requiredStructure: "Use 'may', 'might', or 'might not' for ~50% uncertainty.",
      sourceTriggers: "Express clear uncertainty in Ukrainian without copying English idioms (e.g. 'Можливо, ... але я ще не впевнений').",
      englishMustMatchAny: [/\b(may|might)\b/i],
    },
  ],
  "Used to (Past Habits)": [
    {
      id: "used-to-discontinued",
      label: "Discontinued past habit or state (used to / didn't use to)",
      requiredStructure:
        "Use 'used to + base verb' (or 'didn't use to') highlighting something true in the past that is NO LONGER true.",
      sourceTriggers:
        "MUST clearly signal contrast with today in Ukrainian (e.g. 'Раніше ... щоліта, але тепер...', 'Колись ... , а зараз вже ні').",
      forbiddenShortcuts:
        "Do NOT write a single-event past action that translates simply as Past Simple.",
      englishMustMatchAny: [/\bused to\b|\buse to\b/i],
    },
  ],
  "First Conditional": [
    {
      id: "cond-1",
      label: "Real future condition (If + Present Simple, ... will/can/may + verb)",
      requiredStructure:
        "First Conditional sentence: 'If' + Present Simple clause, main clause with 'will / won't / can'. NO 'will' inside the 'if' clause.",
      sourceTriggers:
        "Use real future condition in Ukrainian ('Якщо завтра/пізніше [verb], то ми...').",
      englishMustMatchAny: [/\b(if|unless)\b/i],
    },
  ],
  "Second Conditional": [
    {
      id: "cond-2",
      label: "Unreal present/future hypothetical (If + Past Simple, ... would/could + verb)",
      requiredStructure:
        "Second Conditional: 'If' + Past Simple (including 'were' if natural), main clause with 'would / wouldn't / could'.",
      sourceTriggers:
        "MUST use Ukrainian subjunctive particle 'Якби ... [verb-ло], ... б [verb-ло]' referring to an unreal present/future situation.",
      englishMustMatchAny: [/\bwould\b|'d\b|\bcould\b/i],
    },
  ],
  "Passive Voice (Simple)": [
    {
      id: "passive-simple-present-past",
      label: "Present or Past Simple Passive (is/are/was/were + V3)",
      requiredStructure:
        "Passive construction where the receiver of the action is the English grammatical subject + be (is/are/was/were) + past participle (V3).",
      sourceTriggers:
        "In Ukrainian, place the receiver/object first or use impersonal/passive phrasing ('Цей будинок збудували / було збудовано...', 'Каву подають...', 'Посилку вже доставили / доставлено...'), AVOIDING a prominent personal pronoun subject ('Вони збудували...').",
      englishMustMatchAny: [/\b(is|are|was|were|isn['’]?t|aren['’]?t|wasn['’]?t|weren['’]?t)\s+(?:always\s+|usually\s+|often\s+|already\s+)?[a-z]+(?:ed|en|t|wn|rn|ng|ck|ld|nt|ne)\b/i],
    },
  ],
  "Do vs Make": [
    {
      id: "do-collocation",
      label: "Action/task/chore collocation requiring DO",
      requiredStructure: "Sentence naturally requiring a 'do' collocation (do homework, do the dishes, do business, do your best, do shopping, etc.).",
      sourceTriggers: "Phrase the Ukrainian sentence naturally so the target English verb must be 'do' rather than 'make'.",
      englishMustMatchAny: [/\b(do|does|did|doing|done)\b/i],
    },
    {
      id: "make-collocation",
      label: "Creation/decision/result collocation requiring MAKE",
      requiredStructure: "Sentence naturally requiring a 'make' collocation (make a decision, make a mistake, make progress, make coffee, make a plan, make an effort, etc.).",
      sourceTriggers: "Phrase the Ukrainian sentence naturally so the target English verb must be 'make'.",
      englishMustMatchAny: [/\b(make|makes|made|making)\b/i],
    },
  ],
  "Too / Enough": [
    {
      id: "too-excessive",
      label: "Excessive degree ('too + adj/adv (+ to...)')",
      requiredStructure: "Use 'too + adjective/adverb' showing excess or negative consequence.",
      sourceTriggers: "Use 'надто / занадто' in Ukrainian.",
      englishMustMatchAny: [/\btoo\b/i],
    },
    {
      id: "enough-sufficient",
      label: "Sufficiency ('adj + enough' or 'enough + noun')",
      requiredStructure: "Use 'adjective + enough' (correct word order!) or 'enough + noun'.",
      sourceTriggers: "Use 'достатньо / не вистачає / вистачає' in Ukrainian.",
      englishMustMatchAny: [/\benough\b/i],
    },
  ],

  // ═══ B1 ENGLISH ═══
  "Present Perfect Continuous": [
    {
      id: "ppc-duration",
      label: "Duration up to now (have/has been + V-ing + for/since)",
      requiredStructure:
        "Present Perfect Continuous (have/has been + verb-ing) with 'for ...' or 'since ...' / 'all morning'.",
      sourceTriggers:
        "MUST combine Ukrainian duration ('вже три години', 'з самого ранку', 'цілий день') with an ongoing present-tense imperfective verb ('працює / чекає / шукає / ремонтує').",
      englishMustMatchAny: [/\b(have|has|haven['’]?t|hasn['’]?t|'ve)\s+been\s+\w+ing\b/i],
    },
  ],
  "Future Forms Review": [
    {
      id: "future-rev-will",
      label: "Spontaneous decision / prediction (will / won't)",
      requiredStructure: "Use 'will' for an instant decision, promise, or prediction.",
      sourceTriggers: "Immediate reaction or personal opinion about the future.",
      englishMustMatchAny: [/\b(will|won['’]?t)\b|'ll\b/i],
    },
    {
      id: "future-rev-going-to",
      label: "Intention / visible evidence (going to)",
      requiredStructure: "Use 'be going to' for an existing plan or physical sign.",
      sourceTriggers: "Use 'збирається / планує' or immediate visible evidence.",
      englishMustMatchAny: [/\bgoing to\b/i],
    },
    {
      id: "future-rev-pc",
      label: "Fixed personal arrangement (Present Continuous + future time)",
      requiredStructure: "Use Present Continuous with a future time/date for a confirmed arrangement.",
      sourceTriggers: "Mention a booked/confirmed meeting, flight, or appointment with date/time.",
      englishMustMatchAny: [/\b(am|is|are|'m|'re|'s)\s+\w+ing\b/i],
    },
  ],
  "Used to / Be used to / Get used to": [
    {
      id: "used-to-past",
      label: "Past habit (used to + V1)",
      requiredStructure: "Use 'used to + base verb' for a past habit that stopped.",
      sourceTriggers: "Use 'Раніше ..., але тепер більше ні'.",
      englishMustMatchAny: [/\bused to\b/i],
    },
    {
      id: "be-used-to-state",
      label: "Already accustomed state (be used to + noun / V-ing)",
      requiredStructure: "Use 'am/is/are used to + noun/gerund' meaning already familiar and comfortable with.",
      sourceTriggers: "MUST say someone is ALREADY accustomed ('вже звик(-ла) до того, що...').",
      englishMustMatchAny: [/\b(am|is|are|was|were)\s+(?:not\s+|already\s+)?used to\b/i],
    },
    {
      id: "get-used-to-process",
      label: "Process of becoming accustomed (get used to + noun / V-ing)",
      requiredStructure: "Use 'get/getting/got used to + noun/gerund' for the adaptation process.",
      sourceTriggers: "MUST describe the process of adapting ('поступово звикає до... / важко звикнути до... / ще не звик').",
      englishMustMatchAny: [/\b(get|gets|got|getting)\s+used to\b/i],
    },
  ],
  "Third Conditional": [
    {
      id: "cond-3",
      label: "Unreal past conditional (If + had V3, ... would have + V3)",
      requiredStructure:
        "Third Conditional: 'If + subject + had (not) V3, subject + would/could (not) have + V3'.",
      sourceTriggers:
        "MUST use Ukrainian past conditional ('Якби вчора/тоді ..., то [він би вже тоді] ...') with explicit past time reference so it cannot be confused with 2nd Conditional.",
      englishMustMatchAny: [/\bwould(?:\s+not|n['’]?t)?\s+have\b|\bcould\s+have\b/i],
    },
  ],
  "Zero & First Conditional": [
    {
      id: "cond-0",
      label: "Zero Conditional (general truth: If + Present, Present)",
      requiredStructure: "If/When + Present Simple, Present Simple describing a general law/habit.",
      sourceTriggers: "State a universal cause-and-effect habit ('Кожного разу, коли / Якщо ..., зазвичай...').",
    },
    {
      id: "cond-1-review",
      label: "First Conditional (specific future: If + Present, will/might/can + V1)",
      requiredStructure: "If + Present Simple, will/might/can + base verb for a real future situation.",
      sourceTriggers: "Mention a specific upcoming occasion ('Якщо завтра / цього разу ..., ми ...').",
    },
  ],
  "Passive Voice (Intermediate)": [
    {
      id: "passive-perfect-modal-cont",
      label: "Non-simple Passive (is being V3 / has been V3 / modal + be + V3)",
      requiredStructure:
        "Use Passive Continuous (is/was being + V3), Present Perfect Passive (has/have been + V3), or Modal Passive (must/can/should be + V3).",
      sourceTriggers:
        "Frame the Ukrainian sentence passively/impersonally around the affected object with clear tense/modal markers ('прямо зараз ремонтують', 'вже перевірено', 'має бути надіслано').",
      englishMustMatchAny: [/\b(being|been|be)\s+[a-z]+/i],
    },
  ],
  "Reported Speech (Statements)": [
    {
      id: "rep-statement",
      label: "Reported Statement with tense backshift (said / told someone that...)",
      requiredStructure:
        "Indirect speech reporting verb in past (said/told + object/explained) + backshifted verb tense & shifted time/pronoun reference.",
      sourceTriggers:
        "Begin with an indirect reporting clause in past ('Вона сказала мені, що...', 'Тренер пояснив, що...') and NO direct quotation marks.",
      englishMustMatchAny: [/\b(said|told|explained|mentioned|promised|claimed)\b/i],
    },
  ],
  "Reported Speech (Questions)": [
    {
      id: "rep-question",
      label: "Reported Question (asked if/whether or asked + wh-word + S + V — statement order)",
      requiredStructure:
        "Indirect question using 'asked (me) if/whether' or 'asked (me) where/when/why + subject + backshifted verb' — NO question mark and NO do/did inversion.",
      sourceTriggers:
        "Frame in Ukrainian as an indirect past report ('Він запитав мене, чи...', 'Вона поцікавилася, коли...').",
      englishMustMatchAny: [/\b(asked|wanted to know|wondered)\b/i],
    },
  ],
  "Adjectives ending in -ed / -ing": [
    {
      id: "adj-ed-feeling",
      label: "-ed adjective (how a person feels)",
      requiredStructure: "Use an -ed participial adjective describing a person's emotional state (bored, confused, exhausted, thrilled, disappointed).",
      sourceTriggers: "Focus on how someone felt emotionally ('почувався розчарованим / була приємно вражена').",
    },
    {
      id: "adj-ing-cause",
      label: "-ing adjective (quality of the thing/situation causing the feeling)",
      requiredStructure: "Use an -ing participial adjective describing the cause/thing/event (boring, confusing, exhausting, thrilling, disappointing).",
      sourceTriggers: "Describe the quality of a film, trip, task, or situation ('виявився виснажливим / звучить дивно').",
    },
  ],
  "So vs Such": [
    {
      id: "so-adj-adv",
      label: "'So + adjective/adverb (+ that...)'",
      requiredStructure: "Use 'so + adjective/adverb' without a noun inside the 'so' phrase.",
      sourceTriggers: "Emphasize degree before a standalone adjective or adverb ('настільки втомлений / так швидко').",
      englishMustMatchAny: [/\bso\b/i],
    },
    {
      id: "such-noun-phrase",
      label: "'Such (a/an) + adjective + noun (+ that...)'",
      requiredStructure: "Use 'such' (with 'a/an' if singular countable) before adjective + noun.",
      sourceTriggers: "Emphasize an adjective + noun phrase ('така несподівана новина / настільки складний проєкт').",
      englishMustMatchAny: [/\bsuch\b/i],
    },
  ],
  "Question Tags": [
    {
      id: "question-tag",
      label: "Question Tag (positive statement + negative tag OR negative statement + positive tag)",
      requiredStructure:
        "Statement followed by a comma and a matching auxiliary/pronoun question tag (..., isn't it? / ..., don't you? / ..., haven't they? / ..., did she?).",
      sourceTriggers:
        "MUST end the Ukrainian sentence with a confirmation tag cue such as ', чи не так?' or ', правда ж?'.",
      requiresQuestionMark: true,
      englishMustMatchAny: [/,\s*(isn['’]?t|aren['’]?t|wasn['’]?t|weren['’]?t|don['’]?t|doesn['’]?t|didn['’]?t|haven['’]?t|hasn['’]?t|hadn['’]?t|won['’]?t|can['’]?t|couldn['’]?t|shouldn['’]?t|wouldn['’]?t|is|are|was|were|do|does|did|have|has|had|will|can|could|should|would)\s+\w+\?$/i],
    },
  ],
  "Reflexive Pronouns": [
    {
      id: "reflexive",
      label: "Reflexive Pronoun (myself / yourself / himself / herself / themselves / ourselves)",
      requiredStructure: "Subject acts upon the same subject using a reflexive pronoun, or 'by myself' (= alone).",
      sourceTriggers: "Use 'себе / сам(-а) собі / самостійно' so a reflexive pronoun is required.",
      englishMustMatchAny: [/\b(myself|yourself|himself|herself|itself|ourselves|yourselves|themselves)\b/i],
    },
  ],

  // ═══ B2 ENGLISH ═══
  "Narrative Tenses": [
    {
      id: "narrative-mix",
      label: "Cohesive mini-narrative combining Past Simple + Past Continuous or Past Perfect",
      requiredStructure:
        "Two-clause or two-part past narrative combining at least two different narrative tenses (e.g. background action in Past Continuous + main event in Past Simple, or prior cause in Past Perfect).",
      sourceTriggers:
        "Create a vivid brief story moment in Ukrainian where background action/prior cause and main completed event are unmistakable.",
      englishMustMatchAny: [/\b(was|were|had)\b/i],
    },
  ],
  "Future Continuous": [
    {
      id: "fut-cont",
      label: "Action in progress at a specific future moment (will be + V-ing)",
      requiredStructure:
        "Future Continuous (will be / won't be + verb-ing) anchored to a specific future time.",
      sourceTriggers:
        "MUST include a specific future point ('Завтра о цій порі...', 'У суботу ввечері о восьмій ми саме будемо...').",
      englishMustMatchAny: [/\b(will|'ll|won['’]?t)\s+be\s+\w+ing\b/i],
    },
  ],
  "Future Perfect": [
    {
      id: "fut-perf",
      label: "Action completed before a future deadline (will have + V3)",
      requiredStructure:
        "Future Perfect (will have / won't have + past participle) with 'by [time]'.",
      sourceTriggers:
        "MUST include a deadline cue ('До кінця тижня...', 'До вечора ми вже закінчимо / встигнемо...').",
      englishMustMatchAny: [/\b(will|'ll|won['’]?t)\s+have\b/i],
    },
  ],
  "Past Modals (Should have / Could have)": [
    {
      id: "past-modal-advice-criticism",
      label: "Past regret, criticism, or missed opportunity (should have / shouldn't have / could have + V3)",
      requiredStructure:
        "Use 'should have / shouldn't have / could have + past participle' about a past mistake or missed possibility.",
      sourceTriggers:
        "Use clear past regret/criticism cues ('Тобі варто було заздалегідь...', 'Не треба було вчора...', 'Він міг би ще тоді..., але не зробив цього').",
      englishMustMatchAny: [/\b(should|shouldn['’]?t|could|couldn['’]?t|ought to)\s+have\b/i],
    },
  ],
  "Deduction (Must, Might, Can't)": [
    {
      id: "deduction-pres-must",
      label: "Strong positive deduction from evidence (must + be/V1)",
      requiredStructure: "Observable present evidence + strong positive deduction with 'must'. NO obligation.",
      sourceTriggers: "Provide a clear present clue followed by 'мабуть / точно / напевно зараз...'.",
      englishMustMatchAny: [/\bmust\b/i],
    },
    {
      id: "deduction-pres-cant",
      label: "Strong negative deduction from evidence (can't + be/V1)",
      requiredStructure: "Observable present evidence + impossibility deduction with 'can't' / 'cannot'.",
      sourceTriggers: "Present evidence followed by 'Не може бути, щоб... / Це точно не...'.",
      englishMustMatchAny: [/\b(can['’]?t|cannot)\b/i],
    },
    {
      id: "deduction-pres-might",
      label: "Uncertain deduction from evidence (might / may / could + be/V1)",
      requiredStructure: "Observable evidence + uncertain deduction with 'might/may/could'.",
      sourceTriggers: "Present evidence followed by 'можливо зараз / ймовірно...'.",
      englishMustMatchAny: [/\b(might|may|could)\b/i],
    },
  ],
  "Deduction (Must have / Can't have)": [
    {
      id: "deduction-past-must",
      label: "Strong past deduction from evidence (must have + V3)",
      requiredStructure: "Evidence + 'must have + V3' deduction about the past. NEVER use should/could have.",
      sourceTriggers: "Evidence + 'мабуть / точно вже [зробив у минулому]'.",
      englishMustMatchAny: [/\bmust have\b/i],
    },
    {
      id: "deduction-past-cant",
      label: "Strong negative past deduction (can't have / couldn't have + V3)",
      requiredStructure: "Evidence + 'can't have / couldn't have + V3' impossibility about the past.",
      sourceTriggers: "Evidence + 'Не може бути, щоб він [зробив у минулому]'.",
      englishMustMatchAny: [/\b(can['’]?t|couldn['’]?t|cannot)\s+have\b/i],
    },
    {
      id: "deduction-past-might",
      label: "Uncertain past deduction (might/may have + V3)",
      requiredStructure: "Evidence + 'may/might/may not/might not have + V3'.",
      sourceTriggers: "Evidence + 'можливо, [він зробив у минулому]'.",
      englishMustMatchAny: [/\b(might|may)\s+(?:not\s+)?have\b/i],
    },
  ],
  "Mixed Conditionals": [
    {
      id: "mixed-cond-past-present",
      label: "Past condition → Present result (If + had V3, ... would + V1 now)",
      requiredStructure:
        "If + Past Perfect (unreal past action), main clause with 'would + bare infinitive + now/today'.",
      sourceTriggers:
        "MUST pair a past condition ('Якби тоді / вчора ...') with an explicit present consequence ('... то зараз / сьогодні ми б не...').",
      englishMustMatchAny: [/\bhad\b.*\bwould\b|\bwould\b.*\bhad\b/i],
    },
    {
      id: "mixed-cond-present-past",
      label: "Permanent/present trait → Past result (If + Past Simple, ... would have + V3)",
      requiredStructure:
        "If + Past Simple (permanent trait), main clause with 'would have + V3' (past consequence).",
      sourceTriggers:
        "Pair a general ongoing trait ('Якби він узагалі був більш уважним...') with a specific past result ('... то не загубив би вчора...').",
      englishMustMatchAny: [/\bwould(?:\s+not|n['’]?t)?\s+have\b/i],
    },
  ],
  "Wishes & Regrets (I wish / If only)": [
    {
      id: "wish-present",
      label: "Wish about present state (I wish / If only + Past Simple/were)",
      requiredStructure: "'I wish' or 'If only' + Past Simple/were/could for an unreal present desire.",
      sourceTriggers: "Use 'Шкода, що зараз не... / Якби ж то я зараз...' or 'Хотів би я, щоб...'.",
      englishMustMatchAny: [/\b(wish|if only)\b/i],
    },
    {
      id: "wish-past-regret",
      label: "Regret about past (I wish / If only + had V3)",
      requiredStructure: "'I wish' or 'If only' + Past Perfect ('had/hadn't + V3') about a past event.",
      sourceTriggers: "Use 'Шкода, що я тоді / вчора (не)... / Краще б я вчора...'.",
      englishMustMatchAny: [/\b(wish|if only)\b.*\bhad/i],
    },
  ],
  "Causative (Have something done)": [
    {
      id: "causative-have-get",
      label: "Service done by someone else (have / get + object + V3)",
      requiredStructure:
        "Causative structure: subject + have/get (in any needed tense) + object + past participle (V3).",
      sourceTriggers:
        "Express that the subject arranged/paid for a professional/someone else to do something to their item ('віддав у ремонт / замовив пошив / підстригся у перукаря / полагодили телефон').",
      englishMustMatchAny: [/\b(have|has|had|having|get|gets|got|getting)\b/i],
    },
  ],
  "Inversion (Introduction)": [
    {
      id: "inversion-intro",
      label: "Negative/restrictive adverbial inversion (Never / Rarely / Not only + aux + S + V)",
      requiredStructure:
        "Sentence starting with Never / Rarely / Seldom / Not only / Little + inverted auxiliary + subject + verb.",
      sourceTriggers:
        "Start or strongly emphasize with 'Ніколи ще...', 'Рідко коли...', 'Не лише..., а й...'.",
      englishMustMatchAny: [/^(never|rarely|seldom|not only|little|no sooner|hardly)\b/i],
    },
  ],
  "Cleft Sentences (What I need is...)": [
    {
      id: "cleft-what-it",
      label: "Emphasis cleft ('What ... is/was ...' or 'It is/was ... that/who ...')",
      requiredStructure:
        "Cleft structure ('What [clause] is/was ...' or 'It was [focus] that/who ...').",
      sourceTriggers:
        "Emphasize the focal element clearly in Ukrainian ('Те, що мені справді потрібно, — це...', 'Саме він / Саме ця ідея...').",
      englishMustMatchAny: [/^(what\b|it is\b|it was\b|all i\b|all we\b|the thing\b)/i],
    },
  ],
  "Connectors of Contrast (Despite / In spite of)": [
    {
      id: "contrast-despite-phrase",
      label: "Despite / In spite of + noun/gerund",
      requiredStructure: "Use 'Despite' or 'In spite of' followed strictly by a noun phrase or V-ing (never a full finite clause with 'that').",
      sourceTriggers: "Use 'Незважаючи на + [іменник / те що...]' constructed smoothly for nominal/gerund phrasing.",
      englishMustMatchAny: [/\b(despite|in spite of)\b/i],
    },
  ],

  // ═══ C1 ENGLISH ═══
  "Inverted Conditionals (Should / Had / Were)": [
    {
      id: "inv-cond-should-had-were",
      label: "Formal inverted conditional without 'if' (Should S V / Had S V3 / Were S to V)",
      requiredStructure:
        "Start directly with 'Should [subject]...', 'Had [subject]...', or 'Were [subject] to...' — NO 'if'.",
      sourceTriggers:
        "Use elevated formal tone in Ukrainian ('Якщо раптом...', 'Якби тоді...', 'Якби їм довелося... (офіційно)').",
      englishMustMatchAny: [/^(should|had|were)\b/i],
      englishMustNotMatch: [/\bif\b/i],
    },
  ],
  "Subjunctive Mood": [
    {
      id: "subjunctive-mandative",
      label: "Mandative subjunctive (suggest/insist/essential that + S + bare verb / be)",
      requiredStructure:
        "Trigger verb/adjective (insist/recommend/propose/demand/it is vital/essential) + that + subject (prefer he/she/it to show no -s) + bare base verb (or 'be' / 'not + base verb').",
      sourceTriggers:
        "Use formal recommendation/necessity phrasing with 3rd-person singular subject ('Лікар наполягає, щоб вона негайно...', 'Вкрай важливо, щоб він був...').",
      englishMustMatchAny: [/\b(suggest|recommend|insist|demand|propose|request|essential|vital|important|imperative)\b/i],
    },
  ],
  "Inversion (Negative Adverbials)": [
    {
      id: "inv-neg-adv-c1",
      label: "C1 Negative Inversion (No sooner...than / Hardly...when / Under no circumstances / Only after...)",
      requiredStructure:
        "Open with No sooner...than, Hardly...when, Under no circumstances, On no account, At no time, or Only after/by + auxiliary + subject + verb.",
      sourceTriggers:
        "Use strong emphatic opening in Ukrainian ('Щойно..., як...', 'За жодних обставин...', 'Лише після того, як...').",
      englishMustMatchAny: [/^(no sooner|hardly|scarcely|under no circumstances|on no account|at no time|not until|only after|only by|only when|never|rarely|seldom|not only)\b/i],
    },
  ],
};

function deriveFallbackSubRules(topicKey: string): TopicSubRuleSpec[] {
  const lower = topicKey.toLowerCase();

  // Handle "A vs B" / "A vs. B" contrast topics automatically if not explicitly mapped
  const vsMatch = topicKey.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (vsMatch) {
    const [, rawLeft, rawRight] = vsMatch;
    const leftPart = rawLeft.trim();
    const rightPart = rawRight.trim();
    return [
      {
        id: "contrast-left",
        label: `Focus on FIRST contrasted structure: "${leftPart}"`,
        requiredStructure: `The target translation MUST specifically demonstrate "${leftPart}" (in contrast to "${rightPart}").`,
        sourceTriggers: `Include explicit time/meaning cues in the source sentence so "${leftPart}" is unambiguously required over "${rightPart}".`,
      },
      {
        id: "contrast-right",
        label: `Focus on SECOND contrasted structure: "${rightPart}"`,
        requiredStructure: `The target translation MUST specifically demonstrate "${rightPart}" (in contrast to "${leftPart}").`,
        sourceTriggers: `Include explicit time/meaning cues in the source sentence so "${rightPart}" is unambiguously required over "${leftPart}".`,
      },
    ];
  }

  // Handle slash contrast topics like "A / B"
  if (topicKey.includes(" / ") && !lower.includes("was / were")) {
    const parts = topicKey
      .split(" / ")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 2 && parts.length <= 4) {
      return parts.map((part, idx) => ({
        id: `slash-part-${idx}`,
        label: `Specifically test: "${part}"`,
        requiredStructure: `Craft the sentence so the target translation naturally requires "${part}".`,
        sourceTriggers: `Include unambiguous source-language meaning/context pointing to "${part}".`,
      }));
    }
  }

  // Handle negative/question topics by name
  if (lower.includes("negative")) {
    return [
      {
        id: "auto-neg",
        label: `Negative form of "${topicKey}"`,
        requiredStructure: `Every sentence MUST be a negative sentence demonstrating "${topicKey}".`,
        sourceTriggers: "Express clear negation in the source sentence.",
      },
    ];
  }

  if (lower.includes("question")) {
    return [
      {
        id: "auto-q",
        label: `Question form of "${topicKey}"`,
        requiredStructure: `Every sentence MUST be a direct question demonstrating "${topicKey}" and ending with '?'.`,
        sourceTriggers: "Frame the source sentence as a natural question ending in '?'.",
        requiresQuestionMark: true,
      },
    ];
  }

  return [
    {
      id: "topic-exact",
      label: `Strict enforcement of "${topicKey}"`,
      requiredStructure: `Every candidate MUST clearly require and demonstrate "${topicKey}". Reject any phrasing where the student can naturally translate without using this grammar.`,
      sourceTriggers: `Include clear contextual, temporal, or syntactic cues in the source sentence so translating naturally compels "${topicKey}".`,
    },
  ];
}

export function getTopicSubRules(topicKey: string): TopicSubRuleSpec[] {
  const exact = SUB_RULE_POOLS[topicKey];
  if (exact && exact.length > 0) {
    return exact;
  }

  return deriveFallbackSubRules(topicKey);
}

/**
 * Unbiased Fisher-Yates shuffle.
 */
export function shuffleArrayRandom<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Picks items without repeating until the pool is exhausted, then reshuffles.
 */
function pickDistributed<T>(pool: readonly T[], count: number): T[] {
  const picked: T[] = [];
  let bag = shuffleArrayRandom(pool);

  for (let i = 0; i < count; i += 1) {
    if (bag.length === 0) {
      bag = shuffleArrayRandom(pool);
    }
    const next = bag.pop();
    if (next !== undefined) {
      picked.push(next);
    }
  }

  return picked;
}

export function getCandidateCountForQuiz(
  termCount: number,
  type: "translation" | "translation_list" | "gap_fill",
): number {
  if (type === "translation" || type === "translation_list") {
    return termCount <= 7 ? 4 : 3;
  }

  // Gap-fill can go up to 20 terms; keep token budget nimble while guaranteeing variety
  if (termCount <= 8) return 3;
  if (termCount <= 14) return 2;
  return 2;
}

export function buildWordBlueprints(
  terms: QuizTerm[],
  config: QuizConfig,
  candidateCount: number,
): WordBlueprint[] {
  const contextHints = pickDistributed(NATURAL_CONTEXT_THEMES, terms.length);

  const primaryGrammarTopic = config.grammarTopics?.[0];
  const subRulePool = primaryGrammarTopic
    ? getTopicSubRules(primaryGrammarTopic)
    : undefined;
  const assignedSubRules = subRulePool
    ? pickDistributed(subRulePool, terms.length)
    : undefined;

  return terms.map((term, index) => ({
    term,
    everydayContextHint: contextHints[index],
    subRule: assignedSubRules?.[index],
    candidateCount,
  }));
}

export function formatAvoidSentencesSection(
  avoidSentences?: string[],
  sourceLanguage?: SourceLanguage,
): string {
  if (!avoidSentences || avoidSentences.length === 0) {
    return "";
  }

  const trimmedList = avoidSentences
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 15);

  if (trimmedList.length === 0) {
    return "";
  }

  const langHint =
    sourceLanguage === "ukrainian" ? "Ukrainian or target-language" : "existing";

  return `
═══ ANTI-REPETITION MEMORY (DO NOT REUSE OR PARAPHRASE) ═══
The student has already practiced the ${langHint} sentences below.
You MUST create completely fresh situations, different characters, and different contexts:
${trimmedList.map((sentence) => `- "${sentence}"`).join("\n")}
`;
}

export interface TranslationCandidateShape {
  ukrainianSentence: string;
  englishReference: string;
  highlightText?: string;
}

export interface GapFillCandidateShape {
  sentence: string;
  correctAnswer: string;
}

const UKRAINIAN_LEADING_TAM_EXISTENTIAL_RE =
  /^Там\s+(?:є|був|була|було|були|буде|будуть|немає|не\s+було|не\s+буде)\b/i;

function countWordOccurrences(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

function hasAmbiguousTamCalque(candidate: TranslationCandidateShape): boolean {
  const uk = candidate.ukrainianSentence.trim();
  const en = candidate.englishReference.trim();
  if (!UKRAINIAN_LEADING_TAM_EXISTENTIAL_RE.test(uk)) {
    return false;
  }

  const firstClause = en.split(/[.!?]/)[0] ?? en;
  const startsWithExistentialThere =
    /^\s*(?:there(?:'s|\s+(?:is|are|was|were|isn['’]?t|aren['’]?t|wasn['’]?t|weren['’]?t|will\s+be|won['’]?t\s+be))|(?:is|are|was|were)\s+there)\b/i.test(
      firstClause,
    );

  if (!startsWithExistentialThere) {
    return false;
  }

  return countWordOccurrences(firstClause, /\bthere\b/gi) < 2;
}

function normalizeExistentialThereCandidate(
  candidate: TranslationCandidateShape,
): TranslationCandidateShape {
  if (!hasAmbiguousTamCalque(candidate)) {
    return candidate;
  }

  const en = candidate.englishReference.trim();
  const match = en.match(/^([^.!?]+)([.!?])([\s\S]*)$/);
  if (match) {
    const [, firstClause, punctuation, rest] = match;
    if (!/\bthere\s*$/i.test(firstClause.trim())) {
      return {
        ...candidate,
        englishReference: `${firstClause.trimEnd()} there${punctuation}${rest}`,
      };
    }
    return candidate;
  }

  if (!/\bthere\s*$/i.test(en)) {
    return {
      ...candidate,
      englishReference: `${en} there`,
    };
  }

  return candidate;
}

/**
 * Selects a translation candidate using programmatic validation + uniform randomization.
 */
export function selectTranslationCandidate(
  candidates: TranslationCandidateShape[],
  subRule?: TopicSubRuleSpec,
): TranslationCandidateShape {
  const nonEmpty = candidates.filter(
    (c) =>
      c.ukrainianSentence.trim().length > 0 &&
      c.englishReference.trim().length > 0,
  );
  const pool = nonEmpty.length > 0 ? nonEmpty : candidates;

  if (pool.length <= 1) {
    return normalizeExistentialThereCandidate(pool[0]);
  }

  let filtered = pool;

  const withoutAmbiguousTam = filtered.filter(
    (c) => !hasAmbiguousTamCalque(c),
  );
  if (withoutAmbiguousTam.length > 0) {
    filtered = withoutAmbiguousTam;
  }

  if (subRule) {
    const questionFiltered = subRule.requiresQuestionMark
      ? filtered.filter((c) => c.englishReference.trim().endsWith("?"))
      : filtered;
    if (questionFiltered.length > 0) {
      filtered = questionFiltered;
    }

    if (subRule.englishMustMatchAny && subRule.englishMustMatchAny.length > 0) {
      const regexMatched = filtered.filter((c) =>
        subRule.englishMustMatchAny?.some((pattern) =>
          pattern.test(c.englishReference),
        ),
      );
      if (regexMatched.length > 0) {
        filtered = regexMatched;
      }
    }

    if (subRule.englishMustNotMatch && subRule.englishMustNotMatch.length > 0) {
      const excluded = filtered.filter(
        (c) =>
          !subRule.englishMustNotMatch?.some((pattern) =>
            pattern.test(c.englishReference),
          ),
      );
      if (excluded.length > 0) {
        filtered = excluded;
      }
    }
  }

  // Uniform random pick among validated candidates
  const randomIndex = Math.floor(Math.random() * filtered.length);
  return normalizeExistentialThereCandidate(filtered[randomIndex] ?? pool[0]);
}

/**
 * Selects a gap-fill candidate ensuring a valid "___" blank and uniform randomization.
 */
export function selectGapFillCandidate(
  candidates: GapFillCandidateShape[],
): GapFillCandidateShape {
  const withBlank = candidates.filter(
    (c) =>
      c.sentence.includes("___") &&
      c.correctAnswer.trim().length > 0 &&
      !c.sentence.toLowerCase().includes(c.correctAnswer.trim().toLowerCase()),
  );
  const hasBlankOnly = candidates.filter(
    (c) => c.sentence.includes("___") && c.correctAnswer.trim().length > 0,
  );
  const pool =
    withBlank.length > 0
      ? withBlank
      : hasBlankOnly.length > 0
        ? hasBlankOnly
        : candidates;

  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex] ?? candidates[0];
}

