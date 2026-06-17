import type { FoundationQuestion } from '../types/foundation';

export const FOUNDATION_QUESTIONS: FoundationQuestion[] = [

  // ─── MARKET (14 questions) ─────────────────────────────────────────────────
  { id: 'market_category',    foundationId: 'market', label: 'Market Category',
    description: 'The broad category your market falls into.',
    isRequired: true, inferenceStrategy: 'from_offer_audience', inputType: 'text',
    placeholder: 'e.g. Dog owners, B2B marketers, Healthcare professionals' },

  { id: 'market_segment',     foundationId: 'market', label: 'Specific Segment',
    description: 'The more targeted sub-group within your market category.',
    isRequired: true, inferenceStrategy: 'from_avatars_demographics', inputType: 'text',
    placeholder: 'e.g. First-time dog owners, SEO marketers at agencies' },

  { id: 'market_size',        foundationId: 'market', label: 'Total Potential Customer Base',
    description: 'Estimated number of potential customers in your specific segment.',
    isRequired: true, inferenceStrategy: 'not_inferable', inputType: 'text',
    placeholder: 'e.g. ~50,000 businesses, ~2M consumers' },

  { id: 'market_wtp',         foundationId: 'market', label: 'Willingness to Pay',
    description: 'What customers are willing and able to pay for solutions like yours.',
    isRequired: true, inferenceStrategy: 'from_avatars_price_perception', inputType: 'text',
    placeholder: 'e.g. $50–200/month, $500–2000 one-time' },

  { id: 'market_buyer_user',  foundationId: 'market', label: 'Buyer vs User',
    description: 'Is the person who pays the same as the person who uses?',
    isRequired: false, inferenceStrategy: 'from_messages_buyer_signal', inputType: 'select',
    placeholder: 'Same person / Different person / Mixed' },

  { id: 'market_core_problem', foundationId: 'market', label: 'Core Problem',
    description: 'The primary problem your market faces — ideally in their own words.',
    isRequired: true, inferenceStrategy: 'from_market_intel_core_problem', inputType: 'text' },

  { id: 'market_motivations', foundationId: 'market', label: 'Primary Motivations',
    description: 'Why they want to solve this — the underlying drivers.',
    isRequired: true, inferenceStrategy: 'from_avatars_motivation', inputType: 'text' },

  { id: 'market_values',      foundationId: 'market', label: 'Values & Beliefs',
    description: 'What your market believes in and values most deeply.',
    isRequired: false, inferenceStrategy: 'from_avatars_values_traits', inputType: 'text' },

  { id: 'market_where',       foundationId: 'market', label: 'Where They Spend Time',
    description: 'Platforms, communities, events, media — online and offline.',
    isRequired: false, inferenceStrategy: 'from_avatars_sources', inputType: 'text' },

  { id: 'market_who_trust',   foundationId: 'market', label: 'Who They Trust',
    description: 'Influencers, publications, peers, or authorities your market listens to.',
    isRequired: false, inferenceStrategy: 'from_avatars_sources', inputType: 'text' },

  { id: 'market_awareness',   foundationId: 'market', label: 'Awareness Level',
    description: 'Are they actively seeking solutions, or do you need to educate them?',
    isRequired: true, inferenceStrategy: 'from_market_intel_awareness', inputType: 'select',
    placeholder: 'Problem aware / Solution aware / Unaware' },

  { id: 'market_trends',      foundationId: 'market', label: 'Market Shifts & Macro Trends',
    description: 'External forces that could impact your market behaviour or needs.',
    isRequired: false, inferenceStrategy: 'not_inferable', inputType: 'text',
    placeholder: 'Cultural trends, regulatory shifts — requires external research' },

  { id: 'market_timing',      foundationId: 'market', label: 'Timing or Seasonal Factors',
    description: 'Cyclical patterns that affect when your market is most receptive.',
    isRequired: false, inferenceStrategy: 'not_inferable', inputType: 'text' },

  { id: 'market_competitors', foundationId: 'market', label: 'Competitors & Alternatives',
    description: 'Who they currently use or consider, and how satisfied they are.',
    isRequired: false, inferenceStrategy: 'from_corpus_trust_messages', inputType: 'text' },

  // ─── PRODUCT (11 questions) ────────────────────────────────────────────────
  { id: 'product_oneliner',   foundationId: 'product', label: 'Product One-Liner',
    description: 'What your product is, in the simplest terms.',
    isRequired: true, inferenceStrategy: 'from_offer_product', inputType: 'text',
    placeholder: 'e.g. No-pull harness for sensitive dogs' },

  { id: 'product_jtbd',       foundationId: 'product', label: 'Job-to-be-Done',
    description: 'When ___, I want to ___, so I can ___.',
    isRequired: true, inferenceStrategy: 'from_avatars_motivation', inputType: 'text',
    placeholder: 'When [situation], I want to [motivation], so I can [outcome]' },

  { id: 'product_problems',   foundationId: 'product', label: 'Problems it Solves',
    description: 'The specific problems your product addresses.',
    isRequired: true, inferenceStrategy: 'from_market_intel_core_problem', inputType: 'text' },

  { id: 'product_outcomes',   foundationId: 'product', label: 'Outcomes / Value Created',
    description: 'The results customers get from using your product.',
    isRequired: true, inferenceStrategy: 'from_offer_transformation', inputType: 'text' },

  { id: 'product_capabilities', foundationId: 'product', label: 'Core Capabilities',
    description: 'The key functionality that powers your product.',
    isRequired: true, inferenceStrategy: 'from_offer_specificity', inputType: 'text' },

  { id: 'product_differentiator', foundationId: 'product', label: 'Key Differentiator',
    description: 'What makes you meaningfully different from alternatives.',
    isRequired: true, inferenceStrategy: 'from_offer_audience', inputType: 'text' },

  { id: 'product_ttfv',       foundationId: 'product', label: 'Time to First Value',
    description: 'How quickly users get their first meaningful result.',
    isRequired: true, inferenceStrategy: 'from_avatars_transformation_hook', inputType: 'select',
    placeholder: 'Minutes / Days / Weeks / Months' },

  { id: 'product_frequency',  foundationId: 'product', label: 'Natural Usage Frequency',
    description: 'How often users engage with your product naturally.',
    isRequired: false, inferenceStrategy: 'not_inferable', inputType: 'select',
    placeholder: 'Daily / Weekly / Monthly / Occasional' },

  { id: 'product_social',     foundationId: 'product', label: 'Inherently Social?',
    description: 'Whether your product naturally encourages sharing.',
    isRequired: false, inferenceStrategy: 'not_inferable', inputType: 'select',
    placeholder: 'Yes / No / Partially' },

  { id: 'product_artifacts',  foundationId: 'product', label: 'Creates Valuable Outputs?',
    description: 'Whether using your product creates outputs users want to keep or share.',
    isRequired: false, inferenceStrategy: 'not_inferable', inputType: 'select',
    placeholder: 'Yes / No' },

  { id: 'product_complexity', foundationId: 'product', label: 'Ease of Explanation',
    description: 'How simple or complex your product is to understand from the market\'s POV.',
    isRequired: false, inferenceStrategy: 'from_corpus_aspect_distribution', inputType: 'select',
    placeholder: 'Simple / Moderate / Complex' },

  // ─── BRAND (7 questions) ───────────────────────────────────────────────────
  { id: 'brand_story',        foundationId: 'brand', label: 'Brand Story',
    description: 'The narrative about who you are, what you stand for, and why you exist.',
    isRequired: true, inferenceStrategy: 'from_avatars_emotional_pattern', inputType: 'text' },

  { id: 'brand_personality',  foundationId: 'brand', label: 'Brand Personality',
    description: 'The human characteristics and traits your brand embodies.',
    isRequired: true, inferenceStrategy: 'from_corpus_aspect_distribution', inputType: 'text',
    placeholder: 'e.g. Empowering, Playful, Authoritative, Warm' },

  { id: 'brand_risks',        foundationId: 'brand', label: 'Brand Risks & Guardrails',
    description: 'What you must avoid to maintain brand integrity and trust.',
    isRequired: true, inferenceStrategy: 'from_corpus_trust_messages', inputType: 'text' },

  { id: 'brand_promise',      foundationId: 'brand', label: 'Primary Promise',
    description: 'The main commitment you make to customers.',
    isRequired: false, inferenceStrategy: 'from_offer_transformation', inputType: 'text' },

  { id: 'brand_proof',        foundationId: 'brand', label: 'Proof of Promise',
    description: 'Evidence that you can deliver on your primary promise.',
    isRequired: false, inferenceStrategy: 'from_corpus_trust_messages', inputType: 'text' },

  { id: 'brand_encounter',    foundationId: 'brand', label: 'Context of Encounter',
    description: 'Where and how customers typically interact with your brand first.',
    isRequired: false, inferenceStrategy: 'from_avatars_sources', inputType: 'text' },

  { id: 'brand_innovation',   foundationId: 'brand', label: 'Brand Innovation Priority',
    description: 'How central brand innovation is to your company strategy.',
    isRequired: false, inferenceStrategy: 'not_inferable', inputType: 'select',
    placeholder: 'Core / Important / Secondary / Not a focus' },

  // ─── MODEL (7 questions) ───────────────────────────────────────────────────
  { id: 'model_what',         foundationId: 'model', label: 'What do you charge for?',
    description: 'The specific value, access, or outcomes customers pay for.',
    isRequired: true, inferenceStrategy: 'from_offer_product', inputType: 'text',
    placeholder: 'e.g. Product access, subscription, per transaction' },

  { id: 'model_how',          foundationId: 'model', label: 'Pricing Structure',
    description: 'Your pricing model.',
    isRequired: true, inferenceStrategy: 'from_avatars_price_perception', inputType: 'text',
    placeholder: 'e.g. Monthly subscription, one-time, freemium' },

  { id: 'model_price_points', foundationId: 'model', label: 'Price Points',
    description: 'Your specific prices and tiers.',
    isRequired: true, inferenceStrategy: 'from_avatars_price_perception', inputType: 'text',
    placeholder: 'e.g. $20/mo, $500 upfront' },

  { id: 'model_gross_margin', foundationId: 'model', label: 'Gross Margin (%)',
    description: '(Revenue - COGS) / Revenue * 100 — cannot be inferred from corpus.',
    isRequired: false, inferenceStrategy: 'not_inferable', inputType: 'number',
    placeholder: 'e.g. 70' },

  { id: 'model_expansion',    foundationId: 'model', label: 'Expansion Lever',
    description: 'How average revenue per customer increases over time.',
    isRequired: false, inferenceStrategy: 'from_avatars_motivation', inputType: 'text',
    placeholder: 'e.g. Plan upgrades, add-ons, usage-based' },

  { id: 'model_risk_reversal', foundationId: 'model', label: 'Risk Reversal',
    description: 'How you reduce the buyer\'s perceived risk at point of purchase.',
    isRequired: false, inferenceStrategy: 'from_avatars_risk', inputType: 'text',
    placeholder: 'e.g. 30-day money-back, free trial' },

  { id: 'model_innovation',   foundationId: 'model', label: 'Model Innovation Priority',
    description: 'How central pricing model innovation is to your company strategy.',
    isRequired: false, inferenceStrategy: 'not_inferable', inputType: 'select',
    placeholder: 'Core / Important / Secondary / Not a focus' },
];
