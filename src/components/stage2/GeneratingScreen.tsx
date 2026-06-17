import React from 'react';
import { ContextualSectionLoader } from '../SkeletonLoaders';

const MESSAGES = [
  'Reviewing your company profile…',
  'Matching your offer to customer language…',
  'Crafting your offer…',
  'Polishing the wording…',
];

export const GeneratingScreen: React.FC = () => {
  return <ContextualSectionLoader messages={MESSAGES} cardCount={3} />;
};
