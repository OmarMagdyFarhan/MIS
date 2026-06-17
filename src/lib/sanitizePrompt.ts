/**
 * Strips prompt-injection patterns from user-supplied strings before they
 * are interpolated into AI system/user prompts.
 *
 * This is a defence-in-depth layer, not a complete security solution.
 * Server-side validation (schema max lengths) is the primary control.
 */

const INJECTION_PATTERNS = [
  // Original 8 patterns
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /disregard\s+(all\s+)?(previous|prior|above)/gi,
  /you\s+are\s+now\s+/gi,
  /new\s+instructions?:/gi,
  /system\s*:/gi,
  /\[INST\]/gi,
  /<\|im_start\|>/gi,
  /###\s*instruction/gi,

  // ── Extended patterns (Issue 3) ──────────────────────────────────────────
  /forget\s+(all\s+)?(previous|prior|above|everything)/gi,
  /act\s+as\s+(if\s+you\s+(are|were)|a\s+)/gi,
  /pretend\s+(you\s+are|to\s+be)/gi,
  /your\s+new\s+(role|persona|task|goal|objective)\s+is/gi,
  /do\s+not\s+follow\s+(your|the|any)\s+(previous\s+)?(instructions?|rules?|guidelines?)/gi,
  /override\s+(all\s+)?(previous\s+)?(instructions?|rules?|settings?)/gi,
  /reveal\s+(your\s+)?(system\s+prompt|api\s+key|secret|instructions?)/gi,
  /<\/?s(ystem|ys)\s*>/gi,
  /\[\/INST\]/gi,
  /<\|im_end\|>/gi,
  /<!--.*?-->/gs, // HTML comments that could hide instructions
];

export function sanitizeForPrompt(value: string): string {
  if (!value || typeof value !== 'string') return '';
  let s = value.trim();
  for (const pattern of INJECTION_PATTERNS) {
    s = s.replace(pattern, '[removed]');
  }
  // Hard truncate at 2000 chars for user-supplied fields embedded in prompts
  return s.slice(0, 2000);
}

/**
 * Wraps a customer quote for safe interpolation inside an AI prompt.
 * Applies sanitizeForPrompt first, then wraps in delimiters that make
 * the boundary explicit to the model.
 */
export function sanitizeEvidenceText(value: string): string {
  const cleaned = sanitizeForPrompt(value).slice(0, 500);
  return `<customer_quote>${cleaned}</customer_quote>`;
}
