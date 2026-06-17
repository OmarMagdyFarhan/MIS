import { resolveEmotion as resolveEmotionLocal } from '../lib/emotionMap';
import { PIPELINE_THRESHOLDS } from '../constants/pipelineThresholds';
// ═══════════════════════════════════════════════════════════════════════════════
// AVATAR SERVICE V2 — Phase 10
// KEY CORRECTIONS:
//   1. No hardcoded 10-avatar limit — generates N avatars based on cluster count
//   2. Avatars generated from cluster evidence, not AI guessing
//   3. Full provenance tracking (AvatarGeneration metadata)
// Import path: src/services/avatarServiceV2.ts
// ═══════════════════════════════════════════════════════════════════════════════

import type { Avatar } from '../types';
import type { Cluster, EvidenceMessage } from '../types/pipeline';
import type { AvatarGeneration, CoreEmotion, ProblemStatement, JTBD } from '../types/phase10';
import type { Company } from '../types';
import { EmotionProfileBuilder } from './emotionService';
import { ClusterAnalysisService } from './problemAnalysisService';

// ─── SERVICE ─────────────────────────────────────────────────────────────────

export class AvatarServiceV2 {
  private emotionBuilder = new EmotionProfileBuilder();
  private clusterAnalysis = new ClusterAnalysisService();

  /**
   * Generate avatars from clusters — dynamic count (2–15), no hardcoded 10.
   * @param comments  Map of clusterId → EvidenceMessage[]
   */
  async generateAvatarsFromClusters(
    company: Company,
    clusters: Cluster[],
    comments: Map<string, EvidenceMessage[]>
  ): Promise<Avatar[]> {
    const qualified = clusters.filter(c => {
      const msgs = comments.get(c.id) ?? [];
      return msgs.length >= PIPELINE_THRESHOLDS.MIN_MESSAGES_VALIDATED_CLUSTER && (c.cohesionScore ?? 0) >= PIPELINE_THRESHOLDS.AUTO_VALIDATE_COHESION;
    });

    if (qualified.length === 0) {
      console.log('[AvatarServiceV2] No clusters met quality threshold.');
      return [];
    }

    const avatars: Avatar[] = [];
    for (const cluster of qualified) {
      const clusterComments = comments.get(cluster.id) ?? [];
      const avatar = await this.generateAvatarFromCluster(company, cluster, clusterComments);
      if (avatar) avatars.push(avatar);
    }

    for (const a of avatars) {
      (a as any).score = this.scoreAvatar(a);
    }

    return avatars.sort((a, b) => ((b as any).score ?? 0) - ((a as any).score ?? 0));
  }

  private async generateAvatarFromCluster(
    company: Company,
    cluster: Cluster,
    comments: EvidenceMessage[]
  ): Promise<Avatar | null> {
    try {
      const { problems, jtbd } = await this.clusterAnalysis.analyzeCluster(cluster, comments);
      if (problems.length === 0) return null;

      const emotionalProfile = this.emotionBuilder.buildAvatarEmotionalProfile(comments);
      const conversionProfile = aggregateConversionProfile(comments);

      const generation: AvatarGeneration = {
        method: 'clusters',
        timestamp: Date.now(),
        sourceClusterIds: [cluster.id],
        sourceCommentIds: comments.map(c => c.id),
        commentCount: comments.length,
        clusterCount: 1,
        evidenceQuality: cluster.cohesionScore ?? 0.7,
        clusterCohesion: cluster.cohesionScore ?? 0.7,
        dominantProblems: problems,
        dominantEmotion: emotionalProfile.primaryEmotion,
        dominantJTBD: jtbd ?? undefined,
      };

      const id = uid('avatar');

      const avatar: Avatar = {
        id,
        companyId: company.id,
        clusterId: cluster.id,
        name: makeName(problems, emotionalProfile.primaryEmotion, comments),
        description: makeDescription(problems, emotionalProfile, comments.length),
        definingCharacteristic: makeDefining(problems[0], emotionalProfile),
        visualDescriptor: `${emotionalProfile.primaryEmotion} professional dealing with ${problems[0].problem.toLowerCase()}`,
        category: categorize(problems),
        canHaveSubAvatars: comments.length > 5,
        validationStatus: 'provisional',
        lifecycleStatus: 'emerging',
        acquisitionSource: 'mining',

        // Phase 10 additions — stored in optional fields that existing Avatar supports
        emotionalProfile: {
          primary:   emotionalProfile.primaryEmotion,
          secondary: emotionalProfile.secondaryEmotion,
          specific:  emotionalProfile.specificFeeling,
          feelingWheel: {
            core:  emotionalProfile.primaryEmotion,
            ring1: emotionalProfile.secondaryEmotion,
            ring2: emotionalProfile.specificFeeling,
          },
          intensity: emotionalProfile.intensity,
        },
        conversionProfile,
        jtbd,
        generation,

        evidenceSnapshot: {
          messageCount:       comments.length,
          clusterCohesion:    cluster.cohesionScore ?? 0.7,
          confidenceScore:    cluster.cohesionScore ?? 0.7,
          aspectDistribution: getAspectDistribution(comments),
          corpusVersion:      cluster.corpusVersion,
          recordedAt:         new Date().toISOString(),
        },
      } as unknown as Avatar; // cast because generation/conversionProfile are Phase 10 additions

      return avatar;
    } catch (err) {
      console.error(`[AvatarServiceV2] Error generating avatar for cluster ${cluster.id}:`, err);
      return null;
    }
  }

  /** Check whether a cluster has enough evidence to warrant avatar generation */
  async shouldGenerateAvatar(cluster: Cluster, comments: EvidenceMessage[]): Promise<boolean> {
    return (
      comments.length >= 1 &&
      (cluster.cohesionScore ?? 0) >= PIPELINE_THRESHOLDS.AUTO_VALIDATE_COHESION
    );
  }

  /** Merge two avatars, preserving generation provenance */
  mergeAvatars(a: Avatar, b: Avatar): Avatar {
    const genA = (a as any).generation as AvatarGeneration | undefined;
    const genB = (b as any).generation as AvatarGeneration | undefined;

    const merged = { ...a };
    if (genA && genB) {
      (merged as any).generation = {
        ...genA,
        sourceClusterIds: Array.from(new Set([...genA.sourceClusterIds, ...genB.sourceClusterIds])),
        sourceCommentIds: Array.from(new Set([...genA.sourceCommentIds, ...genB.sourceCommentIds])),
        commentCount: genA.commentCount + genB.commentCount,
        clusterCount: genA.clusterCount + genB.clusterCount,
      };
    }
    merged.mergedFromAvatarIds = [b.id];
    merged.description = `Merged avatar combining insights from ${a.name} and ${b.name}`;
    return merged;
  }

  private scoreAvatar(avatar: Avatar): number {
    const gen = (avatar as any).generation as AvatarGeneration | undefined;
    if (!gen) return 5;
    let s = 5;
    s += Math.min(2, gen.evidenceQuality * 2);
    s += Math.min(2, gen.clusterCohesion  * 2);
    s += Math.min(2, (gen.commentCount / 5) * 2);
    const avgSeverity = gen.dominantProblems.reduce((sum, p) => sum + p.severity, 0)
      / Math.max(gen.dominantProblems.length, 1);
    s += Math.min(2, (avgSeverity / 10) * 2);
    const intensity = (avatar as any).emotionalProfile?.intensity ?? 5;
    s += Math.min(1, intensity / 10);
    return Math.min(10, Math.round(s * 10) / 10);
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function makeName(problems: ProblemStatement[], emotion: CoreEmotion, comments: EvidenceMessage[]): string {
  // Use the most common topic from comments as the role signal
  const topics = comments
    .map(c => c.analysis?.topic ?? '')
    .filter(Boolean);
  const topicFreq: Record<string, number> = {};
  for (const t of topics) topicFreq[t] = (topicFreq[t] ?? 0) + 1;
  const topTopic = Object.entries(topicFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

  const emotionLabel: Record<CoreEmotion, string> = {
    happy: 'Optimistic', angry: 'Frustrated', scared: 'Risk-Aware', sad: 'Struggling',
  };

  // Derive role from top problem + topic
  const p = problems[0]?.problem.toLowerCase() ?? topTopic.toLowerCase();
  let role = 'Decision Maker';
  if (p.includes('integration') || p.includes('api') || p.includes('connect')) role = 'Integration Lead';
  else if (p.includes('cost') || p.includes('price') || p.includes('budget')) role = 'Budget Owner';
  else if (p.includes('time') || p.includes('slow') || p.includes('speed')) role = 'Efficiency Seeker';
  else if (p.includes('trust') || p.includes('secure') || p.includes('safe')) role = 'Risk Manager';
  else if (p.includes('complex') || p.includes('difficult') || p.includes('hard')) role = 'Overwhelmed Operator';
  else if (p.includes('result') || p.includes('outcome') || p.includes('roi')) role = 'Results-Driven Buyer';
  else if (p.includes('support') || p.includes('help') || p.includes('team')) role = 'Team Champion';
  else if (topTopic.length > 3) role = topTopic.split(' ').slice(0, 2).map(
    w => w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ');

  return `${emotionLabel[emotion]} ${role}`;
}

function makeDescription(problems: ProblemStatement[], ep: any, count: number): string {
  const top = problems.slice(0, 2).map(p => p.problem).join(' and ');
  return `Based on ${count} customer comment(s), this avatar primarily faces: ${top}. ${ep.description}`;
}

function makeDefining(problem: ProblemStatement | undefined, ep: any): string {
  return `Struggling with ${(problem?.problem ?? 'key challenges').toLowerCase()} and feeling ${ep.specificFeeling}`;
}

function categorize(problems: ProblemStatement[]): Avatar['category'] {
  const p = problems[0]?.problem.toLowerCase() ?? '';
  if (p.includes('setup') || p.includes('time')) return 'Triggering Events';
  return 'Goals and Challenges';
}

function aggregateConversionProfile(comments: EvidenceMessage[]) {
  const m = { desiredOutcomes: [] as string[], painPoints: [] as string[], purchasePrompts: [] as string[], confidence: 0.7, sourceCommentIds: [] as string[] };
  const v = { uniqueBenefits: [] as string[], delightfulFeatures: [] as string[], dealreakerNeeds: [] as string[], confidence: 0.7, sourceCommentIds: [] as string[] };
  const a = { uncertainties: [] as string[], objections: [] as string[], perceivedRisks: [] as string[], confidence: 0.7, sourceCommentIds: [] as string[] };

  for (const c of comments) {
    const ca = c.analysis?.conversionAspects;
    if (!ca) continue;
    m.desiredOutcomes.push(...(ca.motivation?.desiredOutcomes ?? []));
    m.painPoints.push(...(ca.motivation?.painPoints ?? []));
    m.sourceCommentIds.push(c.id);
    v.uniqueBenefits.push(...(ca.value?.uniqueBenefits ?? []));
    v.sourceCommentIds.push(c.id);
    a.objections.push(...(ca.anxiety?.objections ?? []));
    a.uncertainties.push(...(ca.anxiety?.uncertainties ?? []));
    a.sourceCommentIds.push(c.id);
  }

  m.desiredOutcomes = Array.from(new Set(m.desiredOutcomes));
  m.painPoints = Array.from(new Set(m.painPoints));
  v.uniqueBenefits = Array.from(new Set(v.uniqueBenefits));
  a.objections = Array.from(new Set(a.objections));
  a.uncertainties = Array.from(new Set(a.uncertainties));

  return { motivation: m, value: v, anxiety: a };
}

function getAspectDistribution(comments: EvidenceMessage[]): Record<string, number> {
  const d: Record<string, number> = {
    emotional_happy: 0, emotional_angry: 0, emotional_scared: 0, emotional_sad: 0,
    aspect_motivation: 0, aspect_value: 0, aspect_anxiety: 0,
  };
  for (const c of comments) {
    if (c.analysis?.emotion) {
      const core = resolveEmotionLocal(c.analysis.emotion).core.toLowerCase();
      d[`emotional_${core}`] = (d[`emotional_${core}`] ?? 0) + 1;
    }
    if (c.analysis?.conversionAspects) { d.aspect_motivation++; d.aspect_value++; d.aspect_anxiety++; }
  }
  return d;
}
