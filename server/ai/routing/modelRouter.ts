/**
 * Model allowlist and Zod request schemas for AI HTTP routes.
 * @module server/ai/routing/modelRouter
 */

import { ALLOWED_MODELS, DEFAULT_GENERATE_MODEL } from '@shared/api/models';
export { ALLOWED_MODELS, DEFAULT_GENERATE_MODEL };

export {
  GenerateRequestSchema as AIRequestSchema,
  ChatRequestSchema     as AIChatRequestSchema,
} from '@shared/api/schemas';
