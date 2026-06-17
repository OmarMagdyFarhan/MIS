import { generateAIContent } from './aiService';
import { sanitizeForPrompt } from '../lib/sanitizePrompt';

export interface TranslationResult {
  originalText: string;
  originalLanguage: string;
  normalizedText: string;
  wasTranslated: boolean;
}

const BATCH_SIZE = 20;

export async function detectAndNormalize(
  texts: string[]
): Promise<TranslationResult[]> {
  if (!texts.length) return [];

  const results: TranslationResult[] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchResults = await normalizeBatch(batch);
    results.push(...batchResults);
  }

  return results;
}

async function normalizeBatch(texts: string[]): Promise<TranslationResult[]> {
  const systemPrompt = `You are a language detection and translation service.
Respond ONLY with valid JSON — no markdown, no explanation.`;

  const userMessage = `Detect the language of each text and translate to English if not already English.

Texts:
${texts.map((t, i) => `${i}: ${sanitizeForPrompt(t.slice(0, 500))}`).join('\n')}

Return JSON array (same order):
[
  {
    "index": 0,
    "originalLanguage": "en",
    "normalizedText": "...",
    "wasTranslated": false
  }
]`;

  try {
    const raw = await generateAIContent({ systemPrompt, userMessage, jsonResponse: true });
    const parsed = Array.isArray(raw) ? raw : (raw as Record<string, unknown>)?.results as unknown[] ?? [];

    return texts.map((originalText, idx) => {
      const entry = (parsed as Array<Record<string, unknown>>).find((r) => r['index'] === idx);
      if (!entry) {
        return { originalText, originalLanguage: 'unknown', normalizedText: originalText, wasTranslated: false };
      }
      return {
        originalText,
        originalLanguage: (entry['originalLanguage'] as string) ?? 'unknown',
        normalizedText: (entry['normalizedText'] as string) ?? originalText,
        wasTranslated: (entry['wasTranslated'] as boolean) ?? false,
      };
    });
  } catch {
    // Fallback: treat all as English
    return texts.map(originalText => ({
      originalText,
      originalLanguage: 'unknown',
      normalizedText: originalText,
      wasTranslated: false,
    }));
  }
}

export function getLanguageLabel(isoCode: string): string {
  const LABELS: Record<string, string> = {
    en: 'English', ar: 'Arabic', es: 'Spanish', fr: 'French',
    de: 'German', pt: 'Portuguese', it: 'Italian', zh: 'Chinese',
    ja: 'Japanese', ko: 'Korean', ru: 'Russian', nl: 'Dutch',
    tr: 'Turkish', pl: 'Polish', sv: 'Swedish',
  };
  return LABELS[isoCode] ?? isoCode.toUpperCase();
}
