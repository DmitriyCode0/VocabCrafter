export interface GrammarLibraryTopicSection {
  title: string;
  items: string[];
}

export interface GrammarLibraryTopicExample {
  sentence: string;
  note?: string;
}

export interface GrammarLibraryTopicQuizOption {
  id: string;
  label: string;
}

export interface GrammarLibraryTopicQuizQuestion {
  question: string;
  options: GrammarLibraryTopicQuizOption[];
  correctOptionId: string;
  explanation: string;
}

export interface GrammarLibraryTopicQuiz {
  questions: GrammarLibraryTopicQuizQuestion[];
}

export interface GrammarLibraryTopicContent {
  summary: string;
  formula: string;
  note?: string;
  sections: GrammarLibraryTopicSection[];
  examples: GrammarLibraryTopicExample[];
  quiz?: GrammarLibraryTopicQuiz;
}

const GRAMMAR_LIBRARY_TOPIC_CONTENT: Record<string, GrammarLibraryTopicContent> = {
  "Present Simple with verb: positive": {
    summary:
      "Use the present simple positive form to talk about routines, habits, facts, and permanent situations.",
    formula:
      "I/You/We/They + base verb | He/She/It + verb + s/es",
    note:
      "This card covers positive sentences only. Negative and question forms are separate A1 topics.",
    sections: [
      {
        title: "Use it for",
        items: [
          "Daily routines: I start school at eight.",
          "Repeated habits: They visit their grandmother every Sunday.",
          "Facts and permanent situations: She lives in London.",
        ],
      },
      {
        title: "Remember",
        items: [
          "Add -s with he, she, and it: work -> works.",
          "Add -es after ch, sh, s, x, z, and o: watch -> watches, go -> goes.",
          "Change consonant + y to -ies: study -> studies.",
        ],
      },
      {
        title: "Common mistakes",
        items: [
          '"She work every day" -> "She works every day".',
          '"He study English" -> "He studies English".',
          'Do not add -s with I, you, we, or they: "They live here".',
        ],
      },
      {
        title: "Quick practice",
        items: [
          "I / drink tea in the morning.",
          "My brother / go to school by bus.",
          "We / play football after class.",
        ],
      },
    ],
    examples: [
      {
        sentence: "I drink coffee every morning.",
        note: "Routine",
      },
      {
        sentence: "She works in an office.",
        note: "Third-person singular form",
      },
      {
        sentence: "They live in London.",
        note: "Permanent situation",
      },
    ],
    quiz: {
      questions: [
        {
          question: "Choose the correct present simple positive sentence.",
          options: [
            {
              id: "a",
              label: "She work in a hospital.",
            },
            {
              id: "b",
              label: "She works in a hospital.",
            },
            {
              id: "c",
              label: "She is work in a hospital.",
            },
          ],
          correctOptionId: "b",
          explanation:
            "With he, she, and it, the verb usually takes -s or -es in present simple positive sentences.",
        },
        {
          question: "Pick the sentence with the correct spelling for study.",
          options: [
            {
              id: "a",
              label: "Tom studys English every evening.",
            },
            {
              id: "b",
              label: "Tom studies English every evening.",
            },
            {
              id: "c",
              label: "Tom study English every evening.",
            },
          ],
          correctOptionId: "b",
          explanation:
            "When a verb ends in consonant + y, change y to ies for he, she, or it: study -> studies.",
        },
        {
          question: "Choose the correct sentence with a plural subject.",
          options: [
            {
              id: "a",
              label: "My friends plays tennis on Saturdays.",
            },
            {
              id: "b",
              label: "My friends play tennis on Saturdays.",
            },
            {
              id: "c",
              label: "My friends is play tennis on Saturdays.",
            },
          ],
          correctOptionId: "b",
          explanation:
            "Do not add -s to the main verb with plural subjects like we or they.",
        },
        {
          question: "Which sentence correctly describes a daily routine?",
          options: [
            {
              id: "a",
              label: "I walk to school every day.",
            },
            {
              id: "b",
              label: "I am walk to school every day.",
            },
            {
              id: "c",
              label: "I walking to school every day.",
            },
          ],
          correctOptionId: "a",
          explanation:
            "Use the base verb after I, you, we, or they when you describe a habit or routine.",
        },
        {
          question: "Choose the correct form of go for she.",
          options: [
            {
              id: "a",
              label: "My sister go to work at seven.",
            },
            {
              id: "b",
              label: "My sister goes to work at seven.",
            },
            {
              id: "c",
              label: "My sister going to work at seven.",
            },
          ],
          correctOptionId: "b",
          explanation:
            "Many verbs ending in -o take -es with he, she, or it: go -> goes.",
        },
        {
          question: "Pick the sentence with the correct form of watch.",
          options: [
            {
              id: "a",
              label: "He watch TV after dinner.",
            },
            {
              id: "b",
              label: "He watches TV after dinner.",
            },
            {
              id: "c",
              label: "He watching TV after dinner.",
            },
          ],
          correctOptionId: "b",
          explanation:
            "Verbs ending in -ch usually take -es with he, she, or it: watch -> watches.",
        },
        {
          question: "Which sentence states a general fact in the present simple?",
          options: [
            {
              id: "a",
              label: "Water boil at 100 degrees.",
            },
            {
              id: "b",
              label: "Water boils at 100 degrees.",
            },
            {
              id: "c",
              label: "Water is boil at 100 degrees.",
            },
          ],
          correctOptionId: "b",
          explanation:
            "Use the present simple positive form for facts. A singular subject like water takes boils.",
        },
        {
          question: "Choose the correct sentence with has.",
          options: [
            {
              id: "a",
              label: "My dog have a black nose.",
            },
            {
              id: "b",
              label: "My dog has a black nose.",
            },
            {
              id: "c",
              label: "My dog having a black nose.",
            },
          ],
          correctOptionId: "b",
          explanation:
            "Have changes to has with he, she, and it in present simple positive sentences.",
        },
      ],
    },
  },
  "There vs It": {
    summary:
      "Use 'there' to introduce that something exists or is somewhere, and use 'it' for times, dates, weather, distance, 'It's + adj + to-infinitive', and referring back to something already mentioned.",
    formula:
      "There is/are/was + noun (+ place/time) | It is/was + time/weather/distance/adj + to-verb",
    note: "Remember: every English clause needs ONE subject + verb. Never drop 'It' (say 'It's fantastic!', NOT 'Is fantastic!'), and never double the subject (say 'The worst part is...', NOT 'The worst part it's...').",
    sections: [
      {
        title: "Use THERE",
        items: [
          "To say when or where something is: There are some cups on the table. / There is a party tomorrow.",
          "To say something exists or is happening: There is a problem. / There was an accident.",
        ],
      },
      {
        title: "Use IT",
        items: [
          "To talk about times and dates: It's 4th of July. / It's my birthday. / It's four o'clock. It's very late.",
          "To talk about the weather: It rained a lot yesterday. / It's four degrees.",
          "To talk about distance: How far is it? It's 2 kilometres from the hotel.",
          "Use it's + adjective + to-infinitive: It's nice to see you again. / It was difficult to find the hotel.",
          "To talk about something again: There's a party tonight. It will be fun! / We saw a snake. It was very big.",
        ],
      },
      {
        title: "We need ONE subject + verb",
        items: [
          'Do not double the subject: "The worst part it\'s the speaking." ❌ -> "The worst part is the speaking." ✅',
          'Do not drop the subject "It": "I love their music. Is fantastic!" ❌ -> "I love their music. It\'s fantastic!" ✅',
        ],
      },
    ],
    examples: [
      {
        sentence: "There are some cups on the table.",
        note: "THERE: saying where something is",
      },
      {
        sentence: "There was an accident.",
        note: "THERE: saying something happened",
      },
      {
        sentence: "It's 4th of July. It's my birthday.",
        note: "IT: times and dates",
      },
      {
        sentence: "It rained a lot yesterday. It's four degrees.",
        note: "IT: weather and temperature",
      },
      {
        sentence: "How far is it? It's 2 kilometres from the hotel.",
        note: "IT: distance",
      },
      {
        sentence: "It was difficult to find the hotel.",
        note: "IT + adjective + to-infinitive",
      },
      {
        sentence: "We saw a snake. It was very big.",
        note: "IT: talking about something again",
      },
    ],
    quiz: {
      questions: [
        {
          question: "Complete the sentence: '___ a party tonight. ___ will be fun!'",
          options: [
            { id: "a", label: "It's / There" },
            { id: "b", label: "There's / It" },
            { id: "c", label: "There's / Is" },
          ],
          correctOptionId: "b",
          explanation:
            "Use 'There's' to introduce an event happening, then 'It' to talk about it again (and never drop the subject 'It'!).",
        },
        {
          question: "Choose the correct sentence without a double subject.",
          options: [
            { id: "a", label: "The worst part it's the speaking." },
            { id: "b", label: "The worst part is the speaking." },
            { id: "c", label: "Is the worst part the speaking." },
          ],
          correctOptionId: "b",
          explanation:
            "We need ONE subject + verb. Since 'The worst part' is already the subject, do not add 'it' before 'is'.",
        },
        {
          question: "Complete: 'How far ___? ___ 2 kilometres from the hotel.'",
          options: [
            { id: "a", label: "is there / There's" },
            { id: "b", label: "is it / It's" },
            { id: "c", label: "is / Is" },
          ],
          correctOptionId: "b",
          explanation: "Always use 'it' when asking about or stating distance.",
        },
      ],
    },
  },
};

export function getGrammarLibraryTopicContent(topicKey: string) {
  return GRAMMAR_LIBRARY_TOPIC_CONTENT[topicKey];
}

export function getGrammarLibraryArticleSectionId(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section"
  );
}