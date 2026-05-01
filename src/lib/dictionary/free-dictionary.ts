export interface FreeDictionaryMeaning {
  partOfSpeech: string;
  definitions: Array<{
    definition: string;
    synonyms: string[];
    antonyms: string[];
    example?: string;
  }>;
  synonyms: string[];
  antonyms: string[];
}

export interface FreeDictionaryPhonetic {
  text?: string;
  audio?: string;
  sourceUrl?: string;
}

export interface FreeDictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics: FreeDictionaryPhonetic[];
  meanings: FreeDictionaryMeaning[];
  sourceUrls: string[];
}

export async function lookupFreeDictionary(
  word: string,
): Promise<FreeDictionaryEntry | null> {
  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
        word,
      )}`,
      {
        next: { revalidate: 86400 }, // Cache for 24 hours
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Free Dictionary API error: ${response.status}`);
    }

    const data = (await response.json()) as FreeDictionaryEntry[];
    return data[0] || null;
  } catch (error) {
    console.error(`Failed to lookup word "${word}" in Free Dictionary:`, error);
    return null;
  }
}
