/**
 * SuperStack Public API
 *
 * SuperStack is the nested header system that transforms SuperGrid
 * from a flat grid into a true dimensional pivot table.
 */

// Types
export type {
  FacetConfig,
  HeaderAggregate,
  HeaderNode,
  HeaderTree,
  QueryRow,
  SuperStackCallbacks,
  SuperStackDimensions,
  SuperStackState,
} from './types/superstack';

// Configuration
export {
  COMMON_FACETS,
  DEFAULT_DIMENSIONS,
  formatLabel,
  getHeaderColor,
  HEADER_COLORS,
  MONTH_NAMES,
} from './config/superstack-defaults';

// Builders
export {
  buildHeaderTree,
  findNodeById,
  flattenTree,
  recalculateTree,
} from './builders/header-tree-builder';

// Renderers
export { SuperStackRenderer } from './renderers/superstack-renderer';

// Queries (Phase 99)
export {
  buildHeaderDiscoveryQuery,
  buildSingleAxisQuery,
  buildAggregateQuery,
  type QueryFilter,
  type QueryOptions,
  type BuiltQuery,
  type FilterOperator,
} from './queries/header-discovery';

// Query Utilities (Phase 99)
export {
  createTimeFacetChain,
  createCategoryFacetChain,
  validateFacetConfigs,
  estimateQueryComplexity,
  FACET_PRESETS,
  type TimeFacetLevel,
  type CategoryFacetLevel,
} from './queries/query-utils';

// Hooks (Phase 99)
export {
  useSuperStackData,
  useRowHeaders,
  useColHeaders,
  type SuperStackDataConfig,
  type SuperStackDataResult,
} from './hooks/useSuperStackData';

// Demo Components (Phase 99)
export { SuperStackDemo } from './demos/SuperStackDemo';

// Styles (import for side effects)
import './styles/superstack.css';
