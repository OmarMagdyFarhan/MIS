import { generateAIContent } from '../../../services/aiService';
import { sanitizeForPrompt, sanitizeEvidenceText } from '../../../lib/sanitizePrompt';
import {
  MinedMessage,
  Avatar,
  Company,
  Offer,
  MarketIntelligenceData,
  ConversionFormulaAspect,
  MessageType,
  PsychologicalSubAspect,
  ConversionSignalTag,
  SpecificEmotion,
} from '../../../types';

/**
 * Step 1: Analyze a batch of raw customer messages.
 */
export async function analyzeMessages(
  messages: string[],
  company: Company,
  offer?: Offer
): Promise<Array<{
  topic: string;
  conversionFormulaAspect: ConversionFormulaAspect;
  subAspect?: PsychologicalSubAspect;
  secondaryAspect?: ConversionFormulaAspect;
  secondarySubAspect?: PsychologicalSubAspect;
  conversionSignalTags?: ConversionSignalTag[];
  messageType: MessageType;
  emotion: SpecificEmotion;
}>> {
  const systemPrompt = `You are an expert conversion copywriter and customer research analyst.
You analyze raw customer/prospect quotes and extract structured signal from them.
Always respond ONLY with valid JSON — no markdown, no explanation.`;

  const userMessage = `Company: ${sanitizeForPrompt(company.name)} (${sanitizeForPrompt(company.industry)})
Core Offer: ${offer?.generatedOffer || 'Evidence-based analysis'}

Analyze each customer quote below. For each, return:
- topic: 2-4 word main topic
- conversionFormulaAspect: one of [Anxiety, Motivation, Friction, Incentive, Trust, Urgency, Value]
- subAspect: ONLY if conversionFormulaAspect is Motivation, Value, or Anxiety (Psychological Core):
    - For Motivation: one of ["Desired Outcome", "Pain Point / Problem", "Purchase Prompt"]
    - For Value: one of ["Unique Benefit & Advantage", "Delightful Product Feature", "Dealbreaker Need / Requirement"]
    - For Anxiety: one of ["Uncertainty", "Objection", "Perceived Risk"]
    - Do NOT include subAspect for Friction, Incentive, Trust, or Urgency
- conversionSignalTags: ONLY if conversionFormulaAspect is Friction, Incentive, Trust, or Urgency (Conversion Dynamics):
    - For Friction: array of any applicable: ["Usability Issue", "Complexity", "Effort Cost"]
    - For Incentive: array of any applicable: ["Discount", "Bonus Value", "Reward Framing"]
    - For Trust: array of any applicable: ["High Trust Signal", "Low Trust Signal", "Authority Mention"]
    - For Urgency: array of any applicable: ["Time Pressure", "Scarcity Mention"]
    - Do NOT include conversionSignalTags for Motivation, Value, or Anxiety
- secondaryAspect: ONLY if a second psychological signal is clearly and meaningfully present (≥30% signal weight). Omit otherwise.
- secondarySubAspect: if secondaryAspect is Motivation/Value/Anxiety, include the appropriate subAspect
- messageType: one of [Uncertainty, Dealbreaker Need, Desired Outcome, Objection, Social Proof Signal, Trigger Event, Status Motivation, Loss Aversion]
- emotion: the single most specific emotion label from the Feel Wheel. Must be the deepest, most specific ring label. Choose from:
  Joyful, Curious, Inquisitive, Successful, Confident, Respected, Valued, Courageous, Creative, Loving, Thankful, Sensitive, Intimate, Hopeful, Inspired, Aroused, Cheeky, Free, Energetic, Eager,
  Awe, Astonished, Perplexed, Disillusioned, Dismayed, Shocked, Unfocused, Sleepy, Out of Control, Overwhelmed, Rushed, Pressured, Apathetic, Indifferent, Bored,
  Helpless, Frightened, Worried, Inadequate, Inferior, Worthless, Insignificant, Excluded, Persecuted, Nervous, Exposed,
  Betrayed, Resentful, Disrespected, Ridiculed, Indignant, Violated, Furious, Jealous, Provoked, Hostile, Infuriated, Annoyed, Withdrawn, Numb,
  Sceptical, Dismissive, Judgemental, Embarrassed, Appalled, Revolted, Nauseated, Detestable, Horrified,
  Hesitant, Disappointed, Empty, Remorseful, Ashamed, Powerless, Grief, Fragile, Victimised, Abandoned, Isolated, Ignored

Quotes to analyze:
${messages.map((m, i) => `${i + 1}. ${sanitizeEvidenceText(m)}`).join('\n')}

Return JSON array (same order as input):
[{ "topic": "...", "conversionFormulaAspect": "...", "subAspect": "...", "conversionSignalTags": [...], "secondaryAspect": "...", "secondarySubAspect": "...", "messageType": "...", "emotion": "..." }, ...]`;

  const raw = await generateAIContent({ systemPrompt, userMessage, taskType: 'classification' });
  const clean = String(raw).replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

/**
 * Step 2: Match a message against existing avatars.
 */
export async function matchMessageToAvatar(
  message: MinedMessage,
  avatars: Avatar[],
  company: Company
): Promise<string | null> {
  if (!avatars.length) return null;

  const systemPrompt = `You are a customer segmentation expert. Respond ONLY with valid JSON.`;

  const avatarSummaries = avatars.map(a => ({
    id: a.id,
    name: a.name,
    description: a.description,
    definingCharacteristic: a.definingCharacteristic,
    category: a.category,
  }));

  const userMessage = `Customer message: "${message.text}"
Topic: ${message.topic}
Conversion aspect: ${message.conversionFormulaAspect}
Message type: ${message.messageType}

Company: ${sanitizeForPrompt(company.name)}

Existing avatars:
${JSON.stringify(avatarSummaries, null, 2)}

Does this message strongly match any avatar? If yes, return { "matchedId": "<avatar_id>" }.
If no strong match exists, return { "matchedId": null }
A "strong match" means the message clearly originates from that avatar's psychology, NOT just a demographic overlap.`;

  const raw = await generateAIContent({ systemPrompt, userMessage, taskType: 'classification' });
  const clean = String(raw).replace(/```json|```/g, '').trim();
  const result = JSON.parse(clean);
  return result.matchedId ?? null;
}

/**
 * Step 3a: Create a new avatar seeded from a message (no match found).
 */
export async function createAvatarFromMessage(
  message: MinedMessage,
  company: Company,
  existingAvatars: Avatar[],
  offer?: Offer
): Promise<Partial<Avatar>> {
  const systemPrompt = `You are an expert customer avatar architect. Respond ONLY with valid JSON.`;

  const userMessage = `A real customer said: "${message.text}"
This message signals: topic="${message.topic}", formulaAspect="${message.conversionFormulaAspect}", type="${message.messageType}"

Company: ${sanitizeForPrompt(company.name)} (${sanitizeForPrompt(company.industry)})
Core Offer: ${offer?.generatedOffer || 'Evidence-based analysis'}
Existing avatar names (avoid duplication): ${existingAvatars.map(a => a.name).join(', ') || 'None'}

Create a new customer avatar hypothesis based on this message as primary evidence.
Return JSON:
{
  "name": "Descriptive avatar name",
  "description": "Who this person is in 2-3 sentences",
  "definingCharacteristic": "The one defining trait",
  "visualDescriptor": "How they look/present themselves",
  "category": "Goals and Challenges",
  "canHaveSubAvatars": false,
  "score": 4,
  "reasoning": "Why this message suggests this avatar",
  "questionnaire": {
    "anxious": "What makes them anxious about this topic",
    "motivation": "Their core motivation",
    "fondPast": "What they were like before this problem",
    "complicated": "What makes their situation complicated",
    "valuableInfo": "What info they find most valuable",
    "moneyMotivation": "",
    "healthMotivation": "",
    "designMotivation": "",
    "fun": "",
    "risk": "",
    "proudRoles": "",
    "aspiringRoles": "",
    "averageDay": "",
    "averageExpectation": "",
    "appearanceMotivation": ""
  },
  "transformation": {
    "beforeProblem": "Their problem before your solution",
    "beforeFeelings": "How they feel now",
    "afterBenefit": "Primary benefit they want",
    "afterFeelings": "How they want to feel",
    "hook": "One-line hook for this avatar",
    "beforeHave": "", "beforeDay": "", "beforeStatus": "",
    "afterDeepBenefit": "", "afterHave": "", "afterDay": "", "afterStatus": ""
  }
}`;

  const raw = await generateAIContent({ systemPrompt, userMessage, taskType: 'classification' });
  const clean = String(raw).replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

/**
 * Step 3b: Improve an existing avatar with new message evidence.
 */
export async function improveAvatarWithMessage(
  avatar: Avatar,
  message: MinedMessage,
  company: Company,
  offer?: Offer
): Promise<Partial<Avatar>> {
  const systemPrompt = `You are a customer research synthesist. Respond ONLY with valid JSON.`;

  const userMessage = `Existing avatar: ${JSON.stringify({
    name: avatar.name,
    description: avatar.description,
    score: avatar.score,
    questionnaire: avatar.questionnaire,
    transformation: avatar.transformation,
    synthesis: avatar.synthesis,
  }, null, 2)}

New real customer message (evidence): "${message.text}"
Topic: ${message.topic} | Aspect: ${message.conversionFormulaAspect} | Type: ${message.messageType}

Company: ${sanitizeForPrompt(company.name)} | Context: ${offer?.generatedOffer || 'Evidence-based analysis'}

This real customer message either confirms or refines the avatar hypothesis.
Return a partial avatar update as JSON — only include fields that should change:
{
  "score": <new score, max +1.5 per message, cap at 10>,
  "reasoning": "Updated reasoning incorporating this message",
  "description": "Optionally refined description",
  "questionnaire": { "only": "fields that change" },
  "transformation": { "only": "fields that change" },
  "synthesis": { "updated": "synthesis if relevant" }
}`;

  const raw = await generateAIContent({ systemPrompt, userMessage, taskType: 'classification' });
  const clean = String(raw).replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

/**
 * Step 4: Derive Market Intelligence from all analyzed messages.
 */
export async function deriveMarketIntelligence(
  messages: MinedMessage[],
  company: Company,
  offer?: Offer
): Promise<Omit<MarketIntelligenceData, 'companyId' | 'derivedFromMessageCount' | 'lastUpdatedAt'>> {
  const analyzedMessages = messages.filter(m => m.analyzed && m.text.trim());

  const systemPrompt = `You are a market research strategist. Respond ONLY with valid JSON.`;

  const userMessage = `Company: ${sanitizeForPrompt(company.name)} (${sanitizeForPrompt(company.industry)})
Context: ${offer?.generatedOffer || 'Evidence-based analysis'}

Analyzed customer messages:
${analyzedMessages.map(m => `- "${m.text}" [${m.topic} | ${m.conversionFormulaAspect} | ${m.messageType}]`).join('\n')}

Synthesize market intelligence. Return:
{
  "coreProblem": "The dominant pain in 1-2 sentences",
  "desiredOutcome": "What customers are moving toward",
  "problemAwarenessLevel": "Problem Unaware" | "Problem Aware" | "Solution Aware" | "Product Aware",
  "buyerDescription": "Who actually pays (may differ from user)",
  "userDescription": "Who actually uses the product/service",
  "jobCadence": "How often the job-to-be-done occurs (e.g. daily, weekly, occasionally, once)"
}`;

  const raw = await generateAIContent({ systemPrompt, userMessage, taskType: 'classification' });
  const clean = String(raw).replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}
