/**
 * Detect if text is English or contains non-English (non-Latin) characters.
 * Used to filter vocabulary library entries.
 */

// Latin characters (ASCII a-z, A-Z) and common English punctuation/apostrophes
const ENGLISH_PATTERN = /^[a-zA-Z\s\-'`´ʻ'-]+$/;

// Cyrillic range (includes Ukrainian, Russian, Bulgarian, etc.)
const CYRILLIC_PATTERN = /[\u0400-\u04FF]/;

// Greek
const GREEK_PATTERN = /[\u0370-\u03FF]/;

// Other non-Latin scripts
const NON_LATIN_PATTERN = /[\u0600-\u06FF]|[\u0E00-\u0E7F]|[\u4E00-\u9FFF]|[\u3040-\u309F]|[\u3400-\u4DBF]/;

/**
 * Check if a word contains non-English (non-Latin) characters.
 * Returns true if the word contains Cyrillic, Greek, or other non-Latin scripts.
 */
export function containsNonEnglishCharacters(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  
  // Check for Cyrillic (Ukrainian, Russian, etc.)
  if (CYRILLIC_PATTERN.test(trimmed)) {
    return true;
  }
  
  // Check for Greek
  if (GREEK_PATTERN.test(trimmed)) {
    return true;
  }
  
  // Check for other non-Latin scripts (Arabic, Thai, Chinese, Japanese, etc.)
  if (NON_LATIN_PATTERN.test(trimmed)) {
    return true;
  }
  
  return false;
}

/**
 * Check if a word is valid English.
 * Returns true if word contains only Latin characters and spaces.
 */
export function isEnglishWord(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  
  // Must match English pattern and not contain non-English characters
  return ENGLISH_PATTERN.test(trimmed) && !containsNonEnglishCharacters(trimmed);
}

/**
 * Filter array of items to only include English words.
 */
export function filterEnglishWords<T extends { term: string }>(
  items: T[],
): T[] {
  return items.filter((item) => isEnglishWord(item.term));
}
