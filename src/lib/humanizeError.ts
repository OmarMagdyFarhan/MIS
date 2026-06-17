/**
 * humanizeError — converts technical/internal error messages into
 * human-readable explanations with a likely cause and a suggested fix.
 * Used as a fallback when an underlying error doesn't already provide a
 * user-friendly message.
 *
 * @module src/lib/humanizeError
 */

const PATTERNS: Array<{ test: (msg: string) => boolean; message: string }> = [
  {
    test: (m) => /pipeline failed/i.test(m),
    message: "We couldn't finish analyzing your evidence. This sometimes happens when quotes are too short or too generic — try adding a few more detailed customer quotes and running it again.",
  },
  {
    test: (m) => /network|fetch|timeout|ECONNRESET/i.test(m),
    message: "We couldn't reach the analysis service. Check your connection and try again in a moment.",
  },
  {
    test: (m) => /rate limit|429/i.test(m),
    message: "We're analyzing a lot right now. Wait a moment and try again.",
  },
  {
    test: (m) => /api key|unauthorized|401|403/i.test(m),
    message: "We couldn't authenticate with the AI service. Check your API key in settings and try again.",
  },
  {
    test: (m) => /json|parse|unexpected token/i.test(m),
    message: "We got an unexpected response while analyzing your data. Try again — if it keeps happening, try with a smaller batch of quotes.",
  },
];

/**
 * Returns a human-friendly explanation for an error. If the raw message
 * already looks like a user-facing sentence (ends in punctuation and
 * has no stack-trace artifacts), it's returned as-is.
 */
export function humanizeError(error: unknown, fallback?: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');

  for (const pattern of PATTERNS) {
    if (pattern.test(raw)) return pattern.message;
  }

  // Looks like an already-friendly sentence
  if (/^[A-Z][^{}<>]*[.!?]$/.test(raw.trim()) && raw.length < 200) {
    return raw;
  }

  return fallback ?? "Something went wrong on our end. Try again — if it keeps happening, try with fewer or shorter quotes.";
}
