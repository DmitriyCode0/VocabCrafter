export const DEFAULT_GEMINI_TTS_VOICE = "Kore";
export const GEMINI_TTS_CACHE_NAME = "gemini-tts-v2";
export const GEMINI_TTS_CACHE_NAMES_TO_CLEAR = [
  "gemini-tts-v1",
  GEMINI_TTS_CACHE_NAME,
] as const;

export const GEMINI_TTS_VOICE_OPTIONS = [
  { value: "Zephyr", label: "Zephyr", description: "Bright" },
  { value: "Puck", label: "Puck", description: "Upbeat" },
  { value: "Charon", label: "Charon", description: "Informative" },
  { value: "Kore", label: "Kore", description: "Firm" },
  { value: "Fenrir", label: "Fenrir", description: "Excitable" },
  { value: "Leda", label: "Leda", description: "Youthful" },
  { value: "Orus", label: "Orus", description: "Firm" },
  { value: "Aoede", label: "Aoede", description: "Breezy" },
  { value: "Callirrhoe", label: "Callirrhoe", description: "Easy-going" },
  { value: "Autonoe", label: "Autonoe", description: "Bright" },
  { value: "Enceladus", label: "Enceladus", description: "Breathy" },
  { value: "Iapetus", label: "Iapetus", description: "Clear" },
  { value: "Umbriel", label: "Umbriel", description: "Easy-going" },
  { value: "Algieba", label: "Algieba", description: "Smooth" },
  { value: "Despina", label: "Despina", description: "Smooth" },
  { value: "Erinome", label: "Erinome", description: "Clear" },
  { value: "Algenib", label: "Algenib", description: "Gravelly" },
  { value: "Rasalgethi", label: "Rasalgethi", description: "Informative" },
  { value: "Laomedeia", label: "Laomedeia", description: "Upbeat" },
  { value: "Achernar", label: "Achernar", description: "Soft" },
  { value: "Alnilam", label: "Alnilam", description: "Firm" },
  { value: "Schedar", label: "Schedar", description: "Even" },
  { value: "Gacrux", label: "Gacrux", description: "Mature" },
  {
    value: "Pulcherrima",
    label: "Pulcherrima",
    description: "Forward",
  },
  { value: "Achird", label: "Achird", description: "Friendly" },
  {
    value: "Zubenelgenubi",
    label: "Zubenelgenubi",
    description: "Casual",
  },
  {
    value: "Vindemiatrix",
    label: "Vindemiatrix",
    description: "Gentle",
  },
  { value: "Sadachbia", label: "Sadachbia", description: "Lively" },
  {
    value: "Sadaltager",
    label: "Sadaltager",
    description: "Knowledgeable",
  },
  { value: "Sulafat", label: "Sulafat", description: "Warm" },
] as const;

export const GEMINI_TTS_PREVIEW_SAMPLES = {
  english: [
    {
      label: "Quick Preview",
      text: "Hello. This is how your selected AI voice sounds during quiz playback.",
    },
  ],
  spanish: [
    {
      label: "Quick Preview",
      text: "Hola. Asi suena la voz de IA que elegiste para tus actividades.",
    },
  ],
} as const;

export type GeminiTtsVoice = (typeof GEMINI_TTS_VOICE_OPTIONS)[number]["value"];

export function getGeminiTtsVoiceOption(value?: string | null) {
  return GEMINI_TTS_VOICE_OPTIONS.find((option) => option.value === value);
}

export function getGeminiTtsPreviewSamples(language?: string | null) {
  return language === "spanish"
    ? GEMINI_TTS_PREVIEW_SAMPLES.spanish
    : GEMINI_TTS_PREVIEW_SAMPLES.english;
}

export function normalizeGeminiTtsVoice(value?: string | null): GeminiTtsVoice {
  const match = getGeminiTtsVoiceOption(value);
  return match?.value ?? DEFAULT_GEMINI_TTS_VOICE;
}
