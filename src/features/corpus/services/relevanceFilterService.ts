import { generateAIContent } from '../../../services/aiService';
import type { Company, Offer } from '../../../types';

export interface RelevanceResult {
  messageIndex: number;
  isRelevant: boolean;
  reason: string;
}

/**
 * Batch-checks whether messages are relevant to a company's domain.
 * Returns one result per input message (same order).
 * Uses a single AI call for the entire batch.
 */
export async function filterRelevantMessages(
  messages: string[],
  company: Company,
  offer?: Offer
): Promise<RelevanceResult[]> {
  if (!messages.length) return [];

  const systemPrompt = `You are a message relevance classifier for a marketing intelligence system.
Your job: decide if each customer/prospect quote is relevant to the company described.
"Relevant" means the message could plausibly come from a real or potential customer of this specific company.
Return ONLY valid JSON — no markdown, no explanation.`;

  const userMessage = `Company: ${company.name}
Industry: ${company.industry}
Core offer: ${offer?.generatedOffer || offer?.product || 'Not specified'}

Classify each message as relevant (true) or irrelevant (false).

Messages:
${messages.map((m, i) => `${i}: "${m.slice(0, 300)}"`).join('\n')}

Return JSON array (same order, same count as input):
[{ "index": 0, "isRelevant": true, "reason": "..." }, ...]`;

  try {
    const raw = await generateAIContent({ systemPrompt, userMessage, taskType: 'classification' });
    const clean = String(raw).replace(/```json|```/g, '').trim();
    const parsed: Array<{ index: number; isRelevant: boolean; reason: string }> = JSON.parse(clean);

    // Safety: ensure we have one result per message
    return messages.map((_, i) => {
      const found = parsed.find(r => r.index === i);
      return found
        ? { messageIndex: i, isRelevant: found.isRelevant, reason: found.reason }
        : { messageIndex: i, isRelevant: true, reason: 'Filter fallback — assumed relevant' };
    });
  } catch {
    // On parse failure: assume all relevant (fail-open to avoid blocking users)
    return messages.map((_, i) => ({
      messageIndex: i,
      isRelevant: true,
      reason: 'Filter error — assumed relevant',
    }));
  }
}

// ── Issue 11: Message Quality Gate ──────────────────────────────────────────

export interface MessageQualityResult {
  pass: boolean;
  reason: string;
}

export function scoreMessageQuality(text: string): MessageQualityResult {
  const trimmed = text.trim();

  if (trimmed.length < 10) {
    return { pass: false, reason: 'Too short (< 10 characters)' };
  }

  // Mostly non-alphabetic (numbers, punctuation, emoji spam)
  const alphaRatio =
    (trimmed.match(/[a-zA-Z\u00C0-\u024F\u0600-\u06FF\u4E00-\u9FFF]/g) ?? []).length /
    trimmed.length;
  if (alphaRatio < 0.3) {
    return { pass: false, reason: 'Insufficient text content (too many symbols or numbers)' };
  }

  // Repeated character spam (e.g. "aaaaaaaaaa", "!!!!!!!!!")
  if (/(.)\1{9,}/.test(trimmed)) {
    return { pass: false, reason: 'Repetitive characters detected' };
  }

  // All caps shouting (usually low signal)
  if (trimmed.length > 20 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return { pass: false, reason: 'All-caps text — low signal quality' };
  }

  return { pass: true, reason: 'Passed quality checks' };
}
