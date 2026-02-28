// Isometry v5 — Phase 4 Providers Public API
// Re-exports all provider types, allowlist utilities, and providers.
//
// Downstream consumers (views, StateManager, QueryBuilder) import from here.

// Type system
export type {
  FilterField,
  FilterOperator,
  AxisField,
  SortDirection,
  TimeGranularity,
  ViewType,
  ViewFamily,
  Filter,
  CompiledFilter,
  CompiledAxis,
  CompiledDensity,
  AxisMapping,
  PersistableProvider,
} from './types';

// Allowlist sets and validation utilities
export {
  ALLOWED_FILTER_FIELDS,
  ALLOWED_OPERATORS,
  ALLOWED_AXIS_FIELDS,
  isValidFilterField,
  isValidOperator,
  isValidAxisField,
  validateFilterField,
  validateOperator,
  validateAxisField,
} from './allowlist';

// Providers
export { FilterProvider } from './FilterProvider';
