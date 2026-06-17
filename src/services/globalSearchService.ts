/**
 * globalSearchService — cross-entity search over companies, avatars,
 * insights, and segments (clusters), drawn from existing Zustand stores.
 * Pure function, no new persisted state (Phase 15, Priority 6).
 *
 * @module src/services/globalSearchService
 */

import type { Company, Avatar, ActionableInsight, Progress } from '../types';
import type { Cluster } from '../types/pipeline';
import type { WorkspaceTab } from '../stores/uiStore';

export type SearchResultKind = 'company' | 'avatar' | 'insight' | 'segment';

export interface SearchResult {
  id: string;
  kind: SearchResultKind;
  title: string;
  subtitle?: string;
  /** Company this result belongs to */
  companyId: string;
  /** Workspace tab to navigate to when selected */
  targetTab: WorkspaceTab;
}

interface SearchInputs {
  companies: Company[];
  progress: Record<string, Progress>;
  clustersByCompany: Record<string, Cluster[]>;
}

function matches(text: string | undefined, query: string): boolean {
  if (!text) return false;
  return text.toLowerCase().includes(query);
}

/**
 * Runs a case-insensitive substring search across companies, avatars,
 * actionable insights, and segments (clusters). Returns at most `limit`
 * results, ordered: companies, avatars, segments, insights.
 */
export function searchWorkspace(query: string, inputs: SearchInputs, limit = 20): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: SearchResult[] = [];

  // Companies
  for (const company of inputs.companies) {
    if (matches(company.name, q) || matches(company.industry, q)) {
      results.push({
        id: `company:${company.id}`,
        kind: 'company',
        title: company.name,
        subtitle: company.industry || 'Project',
        companyId: company.id,
        targetTab: 'overview',
      });
    }
  }

  // Avatars
  for (const company of inputs.companies) {
    const avatars: Avatar[] = inputs.progress[company.id]?.avatars ?? [];
    for (const avatar of avatars) {
      if (matches(avatar.name, q) || matches(avatar.description, q) || matches(avatar.definingCharacteristic, q)) {
        results.push({
          id: `avatar:${avatar.id}`,
          kind: 'avatar',
          title: avatar.name,
          subtitle: `${company.name} · Customer profile`,
          companyId: company.id,
          targetTab: 'segments',
        });
      }
    }
  }

  // Segments (clusters)
  for (const company of inputs.companies) {
    const clusters = inputs.clustersByCompany[company.id] ?? [];
    for (const cluster of clusters) {
      if (matches(cluster.label, q)) {
        results.push({
          id: `segment:${cluster.id}`,
          kind: 'segment',
          title: cluster.label,
          subtitle: `${company.name} · Segment`,
          companyId: company.id,
          targetTab: 'segments',
        });
      }
    }
  }

  // Insights
  for (const company of inputs.companies) {
    const insights: ActionableInsight[] = inputs.progress[company.id]?.actionableInsights ?? [];
    for (const insight of insights) {
      if (matches(insight.title, q)) {
        results.push({
          id: `insight:${company.id}:${insight.title}`,
          kind: 'insight',
          title: insight.title,
          subtitle: `${company.name} · Insight`,
          companyId: company.id,
          targetTab: 'intelligence',
        });
      }
    }
  }

  return results.slice(0, limit);
}
