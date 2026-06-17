// ═══════════════════════════════════════════════════════════════════════════════
// EVENT BUS — Phase 10
// Pipeline order: Comments → Clustering → Problems → JTBD → Emotions → Avatar → Offer
// Import path: src/services/eventBus.ts
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  DomainEvent,
  EventHandler,
  EventBus,
  CommentAddedEvent,
  CommentValidatedEvent,
  CommentAnalyzedEvent,
  ClusterCreatedEvent,
  ClusterUpdatedEvent,
  ProblemExtractedEvent,
  JTBDIdentifiedEvent,
  EmotionUpdatedEvent,
  AvatarNeedsRefreshEvent,
  AvatarGeneratedEvent,
  OfferNeedsReviewEvent,
  OfferEvaluatedEvent,
} from '../types/phase10';

// ─── CORE BUS ────────────────────────────────────────────────────────────────

export class DefaultEventBus implements EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();
  private eventLog: DomainEvent[] = [];
  private eventLogMap: Map<string, DomainEvent[]> = new Map();
  private queue: DomainEvent[] = [];
  private draining = false;

  async publish(event: DomainEvent): Promise<void> {
    this.eventLog.push(event);
    if (!this.eventLogMap.has(event.aggregateId)) {
      this.eventLogMap.set(event.aggregateId, []);
    }
    this.eventLogMap.get(event.aggregateId)!.push(event);

    this.queue.push(event);
    if (!this.draining) {
      await this.drain();
    }
  }

  private async drain(): Promise<void> {
    this.draining = true;
    while (this.queue.length > 0) {
      const event = this.queue.shift()!;
      const handlers = this.handlers.get(event.eventType) ?? [];
      if (handlers.length === 0) {
        console.warn(`[EventBus] No handlers for: ${event.eventType}`);
        continue;
      }
      for (const h of handlers) {
        try {
          await h.handle(event);
        } catch (err) {
          console.error(`[EventBus] Handler failed for ${event.eventType}:`, err);
        }
      }
    }
    this.draining = false;
  }

  subscribe(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) this.handlers.set(eventType, []);
    this.handlers.get(eventType)!.push(handler);
  }

  getEventLog(aggregateId: string): DomainEvent[] {
    return this.eventLogMap.get(aggregateId) ?? [];
  }

  getEventsSince(timestamp: number): DomainEvent[] {
    return this.eventLog.filter(e => e.timestamp > timestamp);
  }
}

// ─── SERVICE INTERFACES ───────────────────────────────────────────────────────

export interface MessageService {
  getMessage(id: string): Promise<{ text: string; clusterId?: string }>;
  analyzeEmotion(text: string): Promise<any>;
  analyzeConversionAspects(text: string): Promise<any>;
}

export interface ClusterService {
  getCluster(id: string): Promise<any>;
  getClusterComments(id: string): Promise<any[]>;
  findOrCreateCluster(commentId: string, emotion: any, aspect: any): Promise<string>;
  generateClusterLabel(clusterId: string): Promise<string>;
  getClusterSize(clusterId: string): Promise<number>;
}

export interface ProblemService {
  extractProblemsFromCluster(cluster: any, comments: any[]): Promise<any[]>;
  extractJTBDFromCluster(cluster: any, comments: any[], problems: any[]): Promise<any>;
}

export interface EmotionService {
  aggregateEmotions(comments: any[]): Promise<any>;
}

export interface AvatarService {
  shouldGenerateAvatar(clusterId: string): Promise<boolean>;
  getProblemCount(clusterId: string): Promise<number>;
  getCommentCount(clusterId: string): Promise<number>;
  generateAvatarFromClusters(clusterIds: string[]): Promise<any>;
}

export interface OfferService {
  getOffersForAvatar(avatarId: string): Promise<any[]>;
  getOffer(offerId: string): Promise<any>;
  getAvatar(avatarId: string): Promise<any>;
  scoreOfferForAvatar(offer: any, avatar: any): Promise<any>;
}

// ─── HANDLERS ────────────────────────────────────────────────────────────────

export class CommentAddedEventHandler implements EventHandler<CommentAddedEvent> {
  constructor(private messageService: MessageService, private eventBus: EventBus) {}

  async handle(event: CommentAddedEvent): Promise<void> {
    const confidence = this.validateComment(event.data.text);
    const validationEvent: CommentValidatedEvent = {
      id: `validated-${event.id}`,
      timestamp: Date.now(),
      aggregateId: event.data.commentId,
      version: event.version + 1,
      eventType: 'CommentValidated',
      data: { commentId: event.data.commentId, confidence, problems: [], validatedAt: Date.now() },
    };
    await this.eventBus.publish(validationEvent);
  }

  private validateComment(text: string): number {
    if (!text || text.length < 10) return 0.3;
    if (text.length > 5000) return 0.5;
    return Math.min(1, (text.length - 50) / 500);
  }
}

export class CommentValidatedEventHandler implements EventHandler<CommentValidatedEvent> {
  constructor(private messageService: MessageService, private eventBus: EventBus) {}

  async handle(event: CommentValidatedEvent): Promise<void> {
    const comment = await this.messageService.getMessage(event.data.commentId);
    const emotion = await this.messageService.analyzeEmotion(comment.text);
    const conversionAspects = await this.messageService.analyzeConversionAspects(comment.text);

    const analysisEvent: CommentAnalyzedEvent = {
      id: `analyzed-${event.id}`,
      timestamp: Date.now(),
      aggregateId: event.data.commentId,
      version: event.version + 1,
      eventType: 'CommentAnalyzed',
      data: { commentId: event.data.commentId, emotion, conversionAspect: conversionAspects, clusterId: comment.clusterId || '' },
    };
    await this.eventBus.publish(analysisEvent);
  }
}

export class CommentAnalyzedEventHandler implements EventHandler<CommentAnalyzedEvent> {
  constructor(private clusterService: ClusterService, private eventBus: EventBus) {}

  async handle(event: CommentAnalyzedEvent): Promise<void> {
    let clusterId = event.data.clusterId;

    if (!clusterId) {
      const resolved = await this.clusterService.findOrCreateCluster(
        event.data.commentId, event.data.emotion, event.data.conversionAspect
      );

      if (!resolved) {
        console.log(
          `[EventBus] message ${event.data.commentId} has no cluster yet — ` +
          `waiting for pipeline run.`
        );
        return;
      }
      clusterId = resolved;
    }

    const memberCount = await this.clusterService.getClusterSize(clusterId);
    const clusterEvent: ClusterUpdatedEvent = {
      id:          `cluster-updated-${event.id}`,
      timestamp:   Date.now(),
      aggregateId: clusterId,
      version:     2,
      eventType:   'ClusterUpdated',
      data: {
        clusterId,
        memberCount,
        confidenceChange: 0.1,
        newMembers: [event.data.commentId],
      },
    };
    await this.eventBus.publish(clusterEvent);
  }
}

/** KEY CORRECTION: Problems extracted from cluster context, not individual comment */
export class ClusterUpdatedEventHandler implements EventHandler<ClusterUpdatedEvent> {
  constructor(
    private clusterService: ClusterService,
    private problemService: ProblemService,
    private eventBus: EventBus
  ) {}

  async handle(event: ClusterUpdatedEvent): Promise<void> {
    const cluster = await this.clusterService.getCluster(event.data.clusterId);
    const comments = await this.clusterService.getClusterComments(event.data.clusterId);

    const problems = await this.problemService.extractProblemsFromCluster(cluster, comments);

    for (const problem of problems) {
      const problemEvent: ProblemExtractedEvent = {
        id: `problem-${event.id}-${problem.id}`,
        timestamp: Date.now(),
        aggregateId: problem.id,
        version: 1,
        eventType: 'ProblemExtracted',
        data: {
          problemId: problem.id,
          clusterId: event.data.clusterId,
          rootCause: problem.rootCause,
          severity: problem.severity,
          affectedCommentCount: problem.affectedCommentIds.length,
          relatedCommentIds: problem.affectedCommentIds,
        },
      };
      await this.eventBus.publish(problemEvent);
    }

    /** KEY CORRECTION: JTBD extracted AFTER clustering + problem analysis */
    const jtbd = await this.problemService.extractJTBDFromCluster(cluster, comments, problems);
    if (jtbd) {
      const jtbdEvent: JTBDIdentifiedEvent = {
        id: `jtbd-${event.id}`,
        timestamp: Date.now(),
        aggregateId: jtbd.id,
        version: 1,
        eventType: 'JTBDIdentified',
        data: {
          jtbdId: jtbd.id,
          clusterId: event.data.clusterId,
          functionalJob: jtbd.functionalJob,
          emotionalJob: jtbd.emotionalJob,
          socialJob: jtbd.socialJob,
          confidence: jtbd.confidence,
        },
      };
      await this.eventBus.publish(jtbdEvent);
    }
  }
}

export class EmotionAnalysisEventHandler implements EventHandler<ClusterUpdatedEvent> {
  constructor(
    private clusterService: ClusterService,
    private emotionService: EmotionService,
    private eventBus: EventBus
  ) {}

  async handle(event: ClusterUpdatedEvent): Promise<void> {
    const comments = await this.clusterService.getClusterComments(event.data.clusterId);
    const emotions = await this.emotionService.aggregateEmotions(comments);

    const emotionEvent: EmotionUpdatedEvent = {
      id: `emotion-${event.id}`,
      timestamp: Date.now(),
      aggregateId: event.data.clusterId,
      version: 1,
      eventType: 'EmotionUpdated',
      data: {
        clusterId: event.data.clusterId,
        primaryEmotion: emotions.primary,
        secondaryEmotion: emotions.secondary,
        specificFeelings: emotions.specific,
        intensity: emotions.intensity,
        indicators: emotions.indicators,
      },
    };
    await this.eventBus.publish(emotionEvent);
  }
}

export class AvatarRefreshTriggerHandler implements EventHandler<JTBDIdentifiedEvent | EmotionUpdatedEvent> {
  constructor(private avatarService: AvatarService, private eventBus: EventBus) {}

  async handle(event: JTBDIdentifiedEvent | EmotionUpdatedEvent): Promise<void> {
    const clusterId = event.data.clusterId;
    const shouldGenerate = await this.avatarService.shouldGenerateAvatar(clusterId);

    if (shouldGenerate) {
      const avatarEvent: AvatarNeedsRefreshEvent = {
        id: `avatar-refresh-${event.id}`,
        timestamp: Date.now(),
        aggregateId: clusterId,
        version: 1,
        eventType: 'AvatarNeedsRefresh',
        data: {
          avatarId: `avatar-${clusterId}`,
          reason: 'Cluster analysis complete',
          sourceClusters: [clusterId],
          problemCount: await this.avatarService.getProblemCount(clusterId),
          commentCount: await this.avatarService.getCommentCount(clusterId),
        },
      };
      await this.eventBus.publish(avatarEvent);
    }
  }
}

export class AvatarGenerationEventHandler implements EventHandler<AvatarNeedsRefreshEvent> {
  constructor(private avatarService: AvatarService, private eventBus: EventBus) {}

  async handle(event: AvatarNeedsRefreshEvent): Promise<void> {
    const avatar = await this.avatarService.generateAvatarFromClusters(event.data.sourceClusters);
    const avatarEvent: AvatarGeneratedEvent = {
      id: `avatar-generated-${event.id}`,
      timestamp: Date.now(),
      aggregateId: avatar.id,
      version: 1,
      eventType: 'AvatarGenerated',
      data: {
        avatarId: avatar.id,
        name: avatar.name,
        sourceClusters: avatar.generation?.sourceClusterIds || [],
        score: avatar.score || 0,
        generation: avatar.generation!,
      },
    };
    await this.eventBus.publish(avatarEvent);
  }
}

export class OfferReviewTriggerHandler implements EventHandler<AvatarGeneratedEvent> {
  constructor(private offerService: OfferService, private eventBus: EventBus) {}

  async handle(event: AvatarGeneratedEvent): Promise<void> {
    const offers = await this.offerService.getOffersForAvatar(event.data.avatarId);
    for (const offer of offers) {
      const offerEvent: OfferNeedsReviewEvent = {
        id: `offer-review-${event.id}-${offer.id}`,
        timestamp: Date.now(),
        aggregateId: offer.id,
        version: 1,
        eventType: 'OfferNeedsReview',
        data: { offerId: offer.id, avatarId: event.data.avatarId, reason: 'Avatar updated', mismatches: [], recommendations: [] },
      };
      await this.eventBus.publish(offerEvent);
    }
  }
}

export class OfferEvaluationEventHandler implements EventHandler<OfferNeedsReviewEvent> {
  constructor(private offerService: OfferService, private eventBus: EventBus) {}

  async handle(event: OfferNeedsReviewEvent): Promise<void> {
    const offer = await this.offerService.getOffer(event.data.offerId);
    const avatar = await this.offerService.getAvatar(event.data.avatarId);
    const score = await this.offerService.scoreOfferForAvatar(offer, avatar);

    const evaluationEvent: OfferEvaluatedEvent = {
      id: `offer-evaluated-${event.id}`,
      timestamp: Date.now(),
      aggregateId: event.data.offerId,
      version: 1,
      eventType: 'OfferEvaluated',
      data: { offerId: event.data.offerId, score, reasoning: `Offer alignment: ${score.total}/10` },
    };
    await this.eventBus.publish(evaluationEvent);
  }
}

// ─── FACTORY ─────────────────────────────────────────────────────────────────

/**
 * Wire up the full event-driven pipeline.
 * Call this once in App.tsx and pass the returned bus to services that need it.
 *
 * @example
 * // src/App.tsx
 * const eventBus = createEventBus(messageService, clusterService, problemService, emotionService, avatarService, offerService);
 */
export function createEventBus(
  messageService: MessageService,
  clusterService: ClusterService,
  problemService: ProblemService,
  emotionService: EmotionService,
  avatarService: AvatarService,
  offerService: OfferService
): EventBus {
  const bus = new DefaultEventBus();

  bus.subscribe('CommentAdded',       new CommentAddedEventHandler(messageService, bus));
  bus.subscribe('CommentValidated',   new CommentValidatedEventHandler(messageService, bus));
  bus.subscribe('CommentAnalyzed',    new CommentAnalyzedEventHandler(clusterService, bus));
  bus.subscribe('ClusterUpdated',     new ClusterUpdatedEventHandler(clusterService, problemService, bus));
  bus.subscribe('ClusterUpdated',     new EmotionAnalysisEventHandler(clusterService, emotionService, bus));
  bus.subscribe('JTBDIdentified',     new AvatarRefreshTriggerHandler(avatarService, bus));
  bus.subscribe('EmotionUpdated',     new AvatarRefreshTriggerHandler(avatarService, bus));
  bus.subscribe('AvatarNeedsRefresh', new AvatarGenerationEventHandler(avatarService, bus));
  bus.subscribe('AvatarGenerated',    new OfferReviewTriggerHandler(offerService, bus));
  bus.subscribe('OfferNeedsReview',   new OfferEvaluationEventHandler(offerService, bus));

  return bus;
}
