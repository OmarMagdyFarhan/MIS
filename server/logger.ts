import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',

  // Redact sensitive values before they are written to any log sink.
  // This prevents dev-supplied API keys passed via headers (e.g. x-dev-gemini-key)
  // from appearing in log output if a request object is accidentally serialised.
  redact: {
    paths: [
      'req.headers["x-dev-gemini-key"]',
      'req.headers["x-dev-openrouter-key"]',
      'req.headers["x-dev-openai-key"]',
      'req.headers["authorization"]',
      '*.gemini',
      '*.openrouter',
      '*.openai',
    ],
    censor: '[REDACTED]',
  },

  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});
