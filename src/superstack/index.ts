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

// Styles (import for side effects)
import './styles/superstack.css';
