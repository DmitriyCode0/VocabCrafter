import { GoogleGenAI } from "@google/genai";

export const GEMINI_MODEL = "gemini-2.0-flash";

let _genai: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI {
  if (!_genai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY environment variable");
    }
    _genai = new GoogleGenAI({ apiKey });
  }
  return _genai;
}
