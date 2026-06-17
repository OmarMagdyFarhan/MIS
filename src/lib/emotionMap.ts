import type { SpecificEmotion, MidEmotion, CoreEmotion, MessageEmotion } from '../types';

// Maps specific → { mid, core }
// Every SpecificEmotion must appear exactly once.
const EMOTION_PARENTS: Record<SpecificEmotion, { mid: MidEmotion; core: CoreEmotion }> = {
  // Happy → Playful
  'Joyful':      { mid: 'Playful',  core: 'Happy' },
  'Aroused':     { mid: 'Playful',  core: 'Happy' },
  'Cheeky':      { mid: 'Playful',  core: 'Happy' },
  'Free':        { mid: 'Playful',  core: 'Happy' },
  'Energetic':   { mid: 'Playful',  core: 'Happy' },
  // Happy → Content
  'Curious':     { mid: 'Content',  core: 'Happy' },
  'Inquisitive': { mid: 'Content',  core: 'Happy' },
  // Happy → Interested
  'Successful':  { mid: 'Interested', core: 'Happy' },
  'Confident':   { mid: 'Interested', core: 'Happy' },
  // Happy → Proud
  'Respected':   { mid: 'Proud',    core: 'Happy' },
  'Valued':      { mid: 'Proud',    core: 'Happy' },
  // Happy → Accepted
  'Courageous':  { mid: 'Accepted', core: 'Happy' },
  'Creative':    { mid: 'Accepted', core: 'Happy' },
  'Loving':      { mid: 'Accepted', core: 'Happy' },
  'Thankful':    { mid: 'Accepted', core: 'Happy' },
  'Sensitive':   { mid: 'Accepted', core: 'Happy' },
  'Intimate':    { mid: 'Accepted', core: 'Happy' },
  // Happy → Optimistic
  'Hopeful':     { mid: 'Optimistic', core: 'Happy' },
  'Inspired':    { mid: 'Optimistic', core: 'Happy' },
  'Eager':       { mid: 'Optimistic', core: 'Happy' },
  // Surprised
  'Shocked':         { mid: 'Startled',   core: 'Surprised' },
  'Awe':             { mid: 'Amazed',     core: 'Surprised' },
  'Astonished':      { mid: 'Amazed',     core: 'Surprised' },
  'Perplexed':       { mid: 'Confused',   core: 'Surprised' },
  'Disillusioned':   { mid: 'Confused',   core: 'Surprised' },
  'Dismayed':        { mid: 'Confused',   core: 'Surprised' },
  'Unfocused':       { mid: 'Confused',   core: 'Surprised' },
  // Bad
  'Sleepy':          { mid: 'Tired',      core: 'Bad' },
  'Out of Control':  { mid: 'Stressed',   core: 'Bad' },
  'Overwhelmed':     { mid: 'Stressed',   core: 'Bad' },
  'Rushed':          { mid: 'Busy',       core: 'Bad' },
  'Pressured':       { mid: 'Busy',       core: 'Bad' },
  'Apathetic':       { mid: 'Bored',      core: 'Bad' },
  'Indifferent':     { mid: 'Bored',      core: 'Bad' },
  'Bored':           { mid: 'Bored',      core: 'Bad' },
  // Fearful
  'Helpless':        { mid: 'Scared',     core: 'Fearful' },
  'Frightened':      { mid: 'Scared',     core: 'Fearful' },
  'Worried':         { mid: 'Anxious',    core: 'Fearful' },
  'Inadequate':      { mid: 'Insecure',   core: 'Fearful' },
  'Inferior':        { mid: 'Insecure',   core: 'Fearful' },
  'Worthless':       { mid: 'Weak',       core: 'Fearful' },
  'Insignificant':   { mid: 'Weak',       core: 'Fearful' },
  'Excluded':        { mid: 'Rejected',   core: 'Fearful' },
  'Persecuted':      { mid: 'Rejected',   core: 'Fearful' },
  'Nervous':         { mid: 'Threatened', core: 'Fearful' },
  'Exposed':         { mid: 'Threatened', core: 'Fearful' },
  // Angry
  'Betrayed':        { mid: 'Mad',        core: 'Angry' },
  'Resentful':       { mid: 'Mad',        core: 'Angry' },
  'Disrespected':    { mid: 'Mad',        core: 'Angry' },
  'Ridiculed':       { mid: 'Mad',        core: 'Angry' },
  'Indignant':       { mid: 'Aggressive', core: 'Angry' },
  'Violated':        { mid: 'Aggressive', core: 'Angry' },
  'Furious':         { mid: 'Aggressive', core: 'Angry' },
  'Jealous':         { mid: 'Frustrated', core: 'Angry' },
  'Provoked':        { mid: 'Frustrated', core: 'Angry' },
  'Hostile':         { mid: 'Distant',    core: 'Angry' },
  'Infuriated':      { mid: 'Distant',    core: 'Angry' },
  'Annoyed':         { mid: 'Distant',    core: 'Angry' },
  'Withdrawn':       { mid: 'Critical',   core: 'Angry' },
  'Numb':            { mid: 'Critical',   core: 'Angry' },
  // Disgusted
  'Sceptical':       { mid: 'Disapproving', core: 'Disgusted' },
  'Dismissive':      { mid: 'Disapproving', core: 'Disgusted' },
  'Judgemental':     { mid: 'Disapproving', core: 'Disgusted' },
  'Embarrassed':     { mid: 'Awful',        core: 'Disgusted' },
  'Appalled':        { mid: 'Awful',        core: 'Disgusted' },
  'Revolted':        { mid: 'Repelled',     core: 'Disgusted' },
  'Nauseated':       { mid: 'Repelled',     core: 'Disgusted' },
  'Detestable':      { mid: 'Repelled',     core: 'Disgusted' },
  'Horrified':       { mid: 'Repelled',     core: 'Disgusted' },
  // Sad
  'Hesitant':        { mid: 'Disappointing', core: 'Sad' },
  'Disappointed':    { mid: 'Disappointing', core: 'Sad' },
  'Empty':           { mid: 'Hurt',          core: 'Sad' },
  'Remorseful':      { mid: 'Guilty',        core: 'Sad' },
  'Ashamed':         { mid: 'Guilty',        core: 'Sad' },
  'Powerless':       { mid: 'Despair',       core: 'Sad' },
  'Grief':           { mid: 'Despair',       core: 'Sad' },
  'Fragile':         { mid: 'Vulnerable',    core: 'Sad' },
  'Victimised':      { mid: 'Vulnerable',    core: 'Sad' },
  'Abandoned':       { mid: 'Lonely',        core: 'Sad' },
  'Isolated':        { mid: 'Lonely',        core: 'Sad' },
  'Ignored':         { mid: 'Lonely',        core: 'Sad' },
};

export function resolveEmotion(specific: SpecificEmotion): MessageEmotion {
  const parents = EMOTION_PARENTS[specific];
  if (!parents) {
    return { specific, mid: 'Bored' as MidEmotion, core: 'Bad' as CoreEmotion };
  }
  return { specific, ...parents };
}

export function getEmotionsByCore(core: CoreEmotion): SpecificEmotion[] {
  return (Object.entries(EMOTION_PARENTS) as [SpecificEmotion, { core: CoreEmotion }][])
    .filter(([, v]) => v.core === core)
    .map(([k]) => k);
}

export function getEmotionsByMid(mid: MidEmotion): SpecificEmotion[] {
  return (Object.entries(EMOTION_PARENTS) as [SpecificEmotion, { mid: MidEmotion }][])
    .filter(([, v]) => v.mid === mid)
    .map(([k]) => k);
}
