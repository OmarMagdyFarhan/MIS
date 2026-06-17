export type ValueCategory = 'Functional' | 'Emotional' | 'Life Changing' | 'Social Impact';

export interface ValueElement {
  id: string;
  name: string;
  category: ValueCategory;
  icon: string;
}

export const ELEMENTS_OF_VALUE: ValueElement[] = [
  // Social Impact
  { id: 'self-transcendence', name: 'Self-transcendence', category: 'Social Impact', icon: 'Mountain' },
  
  // Life Changing
  { id: 'provides-hope', name: 'Provides hope', category: 'Life Changing', icon: 'Sunrise' },
  { id: 'self-actualization', name: 'Self-actualization', category: 'Life Changing', icon: 'UserPlus' },
  { id: 'motivation', name: 'Motivation', category: 'Life Changing', icon: 'Zap' },
  { id: 'heirloom', name: 'Heirloom', category: 'Life Changing', icon: 'History' },
  { id: 'affiliation-belonging', name: 'Affiliation/belonging', category: 'Life Changing', icon: 'Users' },
  
  // Emotional
  { id: 'reduces-anxiety', name: 'Reduces anxiety', category: 'Emotional', icon: 'HeartPulse' },
  { id: 'rewards-me', name: 'Rewards me', category: 'Emotional', icon: 'Gift' },
  { id: 'nostalgia', name: 'Nostalgia', category: 'Emotional', icon: 'Camera' },
  { id: 'design-aesthetics', name: 'Design/aesthetics', category: 'Emotional', icon: 'Brush' },
  { id: 'badge-value', name: 'Badge value', category: 'Emotional', icon: 'Award' },
  { id: 'wellness', name: 'Wellness', category: 'Emotional', icon: 'Flower2' },
  { id: 'therapeutic-value', name: 'Therapeutic value', category: 'Emotional', icon: 'Heart' },
  { id: 'fun-entertainment', name: 'Fun/entertainment', category: 'Emotional', icon: 'Music' },
  { id: 'attractiveness', name: 'Attractiveness', category: 'Emotional', icon: 'Magnet' },
  { id: 'provides-access', name: 'Provides access', category: 'Emotional', icon: 'Key' },
  
  // Functional
  { id: 'saves-time', name: 'Saves time', category: 'Functional', icon: 'Clock' },
  { id: 'simplifies', name: 'Simplifies', category: 'Functional', icon: 'Layers' },
  { id: 'makes-money', name: 'Makes money', category: 'Functional', icon: 'Banknote' },
  { id: 'reduces-risk', name: 'Reduces risk', category: 'Functional', icon: 'ShieldCheck' },
  { id: 'organizes', name: 'Organizes', category: 'Functional', icon: 'Folder' },
  { id: 'integrates', name: 'Integrates', category: 'Functional', icon: 'Combine' },
  { id: 'connects', name: 'Connects', category: 'Functional', icon: 'Share2' },
  { id: 'reduces-effort', name: 'Reduces effort', category: 'Functional', icon: 'Gauge' },
  { id: 'avoids-hassles', name: 'Avoids hassles', category: 'Functional', icon: 'CheckCircle2' },
  { id: 'reduces-cost', name: 'Reduces cost', category: 'Functional', icon: 'Tag' },
  { id: 'quality', name: 'Quality', category: 'Functional', icon: 'Star' },
  { id: 'variety', name: 'Variety', category: 'Functional', icon: 'Grid' },
  { id: 'sensory-appeal', name: 'Sensory appeal', category: 'Functional', icon: 'Eye' },
  { id: 'informs', name: 'Informs', category: 'Functional', icon: 'Info' },
];

export const PYRAMID_STRUCTURE = {
  'Social Impact': ['self-transcendence'],
  'Life Changing': ['provides-hope', 'self-actualization', 'motivation', 'heirloom', 'affiliation-belonging'],
  'Emotional': ['reduces-anxiety', 'rewards-me', 'nostalgia', 'design-aesthetics', 'badge-value', 'wellness', 'therapeutic-value', 'fun-entertainment', 'attractiveness', 'provides-access'],
  'Functional': [
    'saves-time', 'simplifies', 'makes-money', 'reduces-risk', 'organizes', 'integrates', 'connects',
    'reduces-effort', 'avoids-hassles', 'reduces-cost', 'quality', 'variety', 'sensory-appeal', 'informs'
  ]
};
