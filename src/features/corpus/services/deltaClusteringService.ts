import { generateAIContent } from '../../../services/aiService';
import type { Company } from '../../../types';
import type { Cluster, EvidenceMessage } from '../../../types/pipeline';

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function deltaCluster(
  company: Company,
  existingClusters: Cluster[],
  newMessages: EvidenceMessage[],
  allMessages: EvidenceMessage[],
  corpusVersion: number
): Promise<{
  updatedClusters: Cluster[];
  newClusters: Cluster[];
  unassigned: string[];
}> {
  const analyzed = newMessages.filter(m => m.analyzed && m.analysis);
  if (!analyzed.length) {
    return { updatedClusters: [], newClusters: [], unassigned: newMessages.map(m => m.id) };
  }

  const activeClusters = existingClusters.filter(
    c => c.status !== 'merged' && c.status !== 'archived'
  );

  if (!activeClusters.length) {
    return { updatedClusters: [], newClusters: [], unassigned: analyzed.map(m => m.id) };
  }

  const clusterSummaries = activeClusters.map(c => {
    const sampleMsgs = allMessages
      .filter(m => c.messageIds.includes(m.id) && m.analyzed)
      .slice(0, 3)
      .map(m => m.normalizedText ?? m.rawText);
    return {
      id: c.id,
      label: c.label,
      dominantAspects: c.dominantAspects ?? [],
      sampleMessages: sampleMsgs,
      messageCount: c.messageIds.length,
    };
  });

  const newSummaries = analyzed.map(m => ({
    id: m.id,
    text: (m.normalizedText ?? m.rawText).slice(0, 200),
    aspect: m.analysis!.conversionFormulaAspect,
    topic: m.analysis!.topic,
  }));

  const systemPrompt = `You are a market segmentation analyst. Respond ONLY with valid JSON.`;
  const userMessage = `Company: ${company.name} (${company.industry})

Existing clusters:
${JSON.stringify(clusterSummaries, null, 2)}

New messages to assign:
${JSON.stringify(newSummaries, null, 2)}

For each new message, either:
1. Assign it to the best-fit existing cluster (if similarity > 0.6)
2. Mark it as "new_cluster" if it doesn't fit any existing cluster

Return JSON:
{
  "assignments": [
    { "messageId": "...", "clusterId": "existing_id_or_null", "isNew": false },
    { "messageId": "...", "clusterId": null, "isNew": true }
  ]
}`;

  let assignments: Array<{ messageId: string; clusterId: string | null; isNew: boolean }> = [];

  try {
    const raw = await generateAIContent({ systemPrompt, userMessage, jsonResponse: true });
    assignments = (raw as { assignments: typeof assignments }).assignments ?? [];
  } catch {
    return { updatedClusters: [], newClusters: [], unassigned: analyzed.map(m => m.id) };
  }

  const now = new Date().toISOString();
  const clusterUpdates = new Map<string, string[]>();
  const newClusterMessages: string[] = [];
  const unassigned: string[] = [];

  for (const assignment of assignments) {
    if (assignment.isNew || !assignment.clusterId) {
      newClusterMessages.push(assignment.messageId);
    } else {
      const existing = clusterUpdates.get(assignment.clusterId) ?? [];
      existing.push(assignment.messageId);
      clusterUpdates.set(assignment.clusterId, existing);
    }
  }

  // Messages not in assignments
  for (const m of analyzed) {
    if (!assignments.find(a => a.messageId === m.id)) {
      unassigned.push(m.id);
    }
  }

  // Build updatedClusters
  const updatedClusters: Cluster[] = [];
  for (const [clusterId, newMsgIds] of clusterUpdates) {
    const cluster = activeClusters.find(c => c.id === clusterId);
    if (!cluster) continue;
    const prevCount = cluster.messageIds.length;
    const newCount = prevCount + newMsgIds.length;
    const prevHistory = cluster.messageCountHistory ?? [];
    updatedClusters.push({
      ...cluster,
      messageIds: [...cluster.messageIds, ...newMsgIds],
      lastGrowthAt: now,
      updatedAt: now,
      messageCountHistory: [
        ...prevHistory,
        { corpusVersion, count: newCount, recordedAt: now },
      ],
      trendDirection: newMsgIds.length > 0 ? 'growing' : 'stable',
      trendDelta: prevCount > 0 ? Math.round((newMsgIds.length / prevCount) * 100) : 100,
    });
  }

  // Build newClusters (one cluster from all new-flagged messages)
  const newClusters: Cluster[] = [];
  if (newClusterMessages.length >= 2) {
    const samples = newClusterMessages.slice(0, 3).map(id => {
      const m = analyzed.find(msg => msg.id === id);
      return m?.analysis?.topic ?? '';
    });
    newClusters.push({
      id: uid('cl'),
      companyId: company.id,
      corpusVersion,
      label: samples.filter(Boolean).join(' / ') || 'New Segment',
      status: 'proposed',
      messageIds: newClusterMessages,
      source: 'mining',
      validationStatus: 'provisional',
      firstSeenAt: now,
      lastGrowthAt: now,
      trendDirection: 'growing',
      createdAt: now,
      updatedAt: now,
      messageCountHistory: [{ corpusVersion, count: newClusterMessages.length, recordedAt: now }],
    });
  } else {
    unassigned.push(...newClusterMessages);
  }

  return { updatedClusters, newClusters, unassigned };
}
