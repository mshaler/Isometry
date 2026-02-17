/**
 * Facet Discovery Service - Re-export for backward compatibility
 *
 * The actual implementation lives in ./query/facet-discovery.ts
 */

export {
  discoverFolderValues,
  discoverStatusValues,
  discoverFacetValues,
  buildFacetDiscoveryQuery,
  type DiscoveredValue,
  type DiscoveryOptions,
  type DiscoveryQuery,
} from './query/facet-discovery';
