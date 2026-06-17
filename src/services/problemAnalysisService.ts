// ═══════════════════════════════════════════════════════════════════════════════
// PROBLEM & JTBD ANALYSIS SERVICE — Phase 10
// KEY CORRECTION: Extracts problems and JTBD from CLUSTER context, not single comments.
// Import path: src/services/problemAnalysisService.ts
// ═══════════════════════════════════════════════════════════════════════════════

import type { ProblemStatement, JTBD } from '../types/phase10';
import type { Cluster, EvidenceMessage } from '../types/pipeline';

// ─── PROBLEM EXTRACTION ───────────────────────────────────────────────────────

export class ProblemAnalysisService {
  /**
   * Extract problems from a cluster of comments.
   * Uses cluster context for higher accuracy than per-comment extraction.
   */
  async extractProblemsFromCluster(
    cluster: Cluster,
    comments: EvidenceMessage[]
  ): Promise<ProblemStatement[]> {
    const problems = new Map<string, ProblemStatement>();

    const motivation = this.aggregateMotivation(comments);
    const anxiety = this.aggregateAnxiety(comments);

    for (const painPoint of motivation.painPoints) {
      const id = uid('problem');
      const affected = comments.filter(c =>
        c.analysis?.conversionAspects?.motivation?.painPoints?.some(pp =>
          pp.toLowerCase().includes(painPoint.toLowerCase())
        )
      );
      if (affected.length > 0) {
        problems.set(id, {
          id,
          clusterId: cluster.id,
          problem: painPoint,
          rootCause: this.identifyRootCause(painPoint, comments),
          severity: this.calculateSeverity(painPoint, comments),
          affectedCommentCount: affected.length,
          affectedCommentIds: affected.map(c => c.id),
          category: 'Pain Point',
        });
      }
    }

    for (const objection of anxiety.objections) {
      const id = uid('problem');
      const affected = comments.filter(c =>
        c.analysis?.conversionAspects?.anxiety?.objections?.some(o =>
          o.toLowerCase().includes(objection.toLowerCase())
        )
      );
      if (affected.length > 0) {
        problems.set(id, {
          id,
          clusterId: cluster.id,
          problem: `Objection: ${objection}`,
          rootCause: `Customer hesitates because: ${objection}`,
          severity: this.calculateSeverity(objection, comments),
          affectedCommentCount: affected.length,
          affectedCommentIds: affected.map(c => c.id),
          category: 'Objection',
        });
      }
    }

    return Array.from(problems.values()).sort((a, b) => b.severity - a.severity);
  }

  private identifyRootCause(problemStatement: string, comments: EvidenceMessage[]): string {
    const related = comments.filter(c =>
      c.rawText.toLowerCase().includes(problemStatement.toLowerCase())
    );
    if (related.length === 0) return `Customers report: ${problemStatement}`;

    const withReason = related.find(c =>
      /because|due to|since|caused by|reason|why/.test(c.rawText.toLowerCase())
    );
    if (withReason) {
      const match = withReason.rawText.match(
        /(?:because|due to|since|caused by|reason:|why:|is that)[^.!?]*[.!?]/i
      );
      if (match) return match[0].trim();
    }

    return `Multiple customers report: ${problemStatement}. Affects ${related.length} comment(s).`;
  }

  private calculateSeverity(problem: string, comments: EvidenceMessage[]): number {
    const related = comments.filter(c =>
      c.rawText.toLowerCase().includes(problem.toLowerCase())
    );
    const frequency = related.length / Math.max(comments.length, 1);
    const avgIntensity =
      related.reduce((sum, c) => sum + (c.analysis?.emotionIntensity ?? 5), 0) /
      Math.max(related.length, 1);
    return Math.min(10, Math.round(frequency * 5 + (avgIntensity / 10) * 5));
  }

  private aggregateMotivation(comments: EvidenceMessage[]) {
    const desiredOutcomes = new Set<string>();
    const painPoints = new Set<string>();
    const purchasePrompts = new Set<string>();
    for (const c of comments) {
      const m = c.analysis?.conversionAspects?.motivation;
      if (m) {
        m.desiredOutcomes?.forEach(v => desiredOutcomes.add(v));
        m.painPoints?.forEach(v => painPoints.add(v));
        m.purchasePrompts?.forEach(v => purchasePrompts.add(v));
      }
    }
    return {
      desiredOutcomes: Array.from(desiredOutcomes),
      painPoints: Array.from(painPoints),
      purchasePrompts: Array.from(purchasePrompts),
    };
  }

  private aggregateAnxiety(comments: EvidenceMessage[]) {
    const uncertainties = new Set<string>();
    const objections = new Set<string>();
    const perceivedRisks = new Set<string>();
    for (const c of comments) {
      const a = c.analysis?.conversionAspects?.anxiety;
      if (a) {
        a.uncertainties?.forEach(v => uncertainties.add(v));
        a.objections?.forEach(v => objections.add(v));
        a.perceivedRisks?.forEach(v => perceivedRisks.add(v));
      }
    }
    return {
      uncertainties: Array.from(uncertainties),
      objections: Array.from(objections),
      perceivedRisks: Array.from(perceivedRisks),
    };
  }
}

// ─── JTBD EXTRACTION ─────────────────────────────────────────────────────────

export class JTBDAnalysisService {
  /**
   * Extract Jobs-To-Be-Done from cluster context.
   * KEY CORRECTION: Works with full cluster data, not a single comment.
   * Confidence is meaningfully higher (target ~0.7+) than per-comment extraction.
   */
  async extractJTBDFromCluster(
    cluster: Cluster,
    comments: EvidenceMessage[],
    problems: ProblemStatement[]
  ): Promise<JTBD | null> {
    if (comments.length === 0) return null;

    const functionalJob = this.identifyFunctionalJob(comments, problems);
    if (!functionalJob) return null;

    const emotionalJob = this.identifyEmotionalJob(comments);
    const socialJob = this.identifySocialJob(comments);
    const confidence = this.calculateConfidence(functionalJob, emotionalJob, socialJob, comments);

    return {
      id: uid('jtbd'),
      clusterId: cluster.id,
      functionalJob,
      emotionalJob,
      socialJob,
      confidence,
      derivedFromComments: comments.map(c => c.id),
    };
  }

  private identifyFunctionalJob(comments: EvidenceMessage[], problems: ProblemStatement[]): string | null {
    const outcomes = new Set<string>();
    for (const c of comments) {
      c.analysis?.conversionAspects?.motivation?.desiredOutcomes?.forEach(o => outcomes.add(o));
    }
    if (outcomes.size === 0) return null;

    const topOutcome = Array.from(outcomes)[0];
    const topBlocker = problems[0]?.problem.toLowerCase();
    return topBlocker ? `${cap(topOutcome)} without ${topBlocker}` : topOutcome;
  }

  private identifyEmotionalJob(comments: EvidenceMessage[]): string {
    const counts = new Map<string, number>();
    for (const c of comments) {
      const e = c.analysis?.emotion;
      if (e) counts.set(e, (counts.get(e) ?? 0) + 1);
    }
    let dominant = 'uncertain';
    let max = 0;
    for (const [e, n] of counts) if (n > max) { max = n; dominant = e; }

    const opposites: Record<string, string> = {
      anxious: 'confident', scared: 'secure', uncertain: 'sure',
      frustrated: 'satisfied', angry: 'peaceful', sad: 'happy',
    };
    const positive = opposites[dominant] ?? 'confident';
    return `Feel ${positive} and in control`;
  }

  private identifySocialJob(comments: EvidenceMessage[]): string {
    const professionalSignals = comments.filter(c =>
      /professional|expert|capable|competent|authority|respect|status/.test(c.rawText.toLowerCase())
    ).length;
    if (professionalSignals > 0) return 'Be seen as technically competent and forward-thinking';

    const teamSignals = comments.filter(c =>
      /team|company|organization|department|leader/.test(c.rawText.toLowerCase())
    ).length;
    if (teamSignals > comments.length * 0.3) return 'Be the person who solved the problem for the team';

    return 'Be the person who made a smart decision';
  }

  private calculateConfidence(
    functionalJob: string, emotionalJob: string, socialJob: string,
    comments: EvidenceMessage[]
  ): number {
    let confidence = 0.5;
    confidence += Math.min(0.2, (comments.length / 10) * 0.2);
    confidence += this.emotionConsistency(comments) * 0.2;
    if (functionalJob.length > 20) confidence += 0.1;
    return Math.min(1, confidence);
  }

  private emotionConsistency(comments: EvidenceMessage[]): number {
    const emotions = comments.map(c => c.analysis?.emotion).filter(Boolean) as string[];
    if (!emotions.length) return 0;
    const counts = new Map<string, number>();
    for (const e of emotions) counts.set(e, (counts.get(e) ?? 0) + 1);
    return Math.max(...counts.values()) / emotions.length;
  }
}

// ─── COMBINED SERVICE ─────────────────────────────────────────────────────────

export class ClusterAnalysisService {
  private problemService = new ProblemAnalysisService();
  private jtbdService = new JTBDAnalysisService();

  async analyzeCluster(cluster: Cluster, comments: EvidenceMessage[]) {
    const problems = await this.problemService.extractProblemsFromCluster(cluster, comments);
    const jtbd = await this.jtbdService.extractJTBDFromCluster(cluster, comments, problems);
    return { problems, jtbd };
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
