// Isometry v5 — Enrichment Pipeline Barrel Export
// Importing this module registers all built-in enrichers.

export { runEnrichmentPipeline, registerEnricher, unregisterEnricher, getRegisteredEnricherIds } from './registry';
export type { Enricher, EnrichedFields } from './types';
export { ENRICHED_FIELD_NAMES } from './types';
export { folderHierarchyEnricher, splitFolderPath } from './FolderHierarchyEnricher';

// ---------------------------------------------------------------------------
// Auto-register built-in enrichers on import
// ---------------------------------------------------------------------------
import { registerEnricher } from './registry';
import { folderHierarchyEnricher } from './FolderHierarchyEnricher';

registerEnricher(folderHierarchyEnricher);
